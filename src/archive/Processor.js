const config            = require( '../app/util/config' );
const { log, logError } = require( '../app/util/log' );
const AWS               = require( 'aws-sdk' );
const { Consumer }      = require( 'sqs-consumer' );
const fs                = require( 'fs' ).promises;
const spawn             = require( 'child-process-promise' ).spawn;
const { join }          = require( 'path' );

const CurrentInstanceId = require( '../app/util/CurrentInstanceId' );

const s3  = new AWS.S3();
const sqs = new AWS.SQS();
const ec2 = new AWS.EC2();


( async () => {
    const instanceId = await CurrentInstanceId();

    let timer = null;

    const setTimer = () => {
        timer = setTimeout( async () => {
            sqsConsumer.stop();
            timer = null;
            while ( true ) {
                try {
                    await ec2.stopInstances( {
                        InstanceIds: [ instanceId ]
                    } ).promise();
                } catch ( err ) {
                }

                await new Promise( r => setTimeout( r, 2000 ) );
            }
        }, 300000 );
        log( `Timer set for 5min` );
    }

    const sqsConsumer = Consumer.create( {
        sqs          : sqs,
        queueUrl     : config.SQS_INPUT_URL,
        handleMessage: async ( message ) => {
            const { s3key, requestId } = JSON.parse( message.Body );

            if ( timer ) {
                clearTimeout( timer );
                log( `Clearing Timer` );
            }

            log( `PROCESSING: ${ requestId }` );


            const ext       = s3key.split( '.' ).pop();
            const localPath = join( process.cwd(), `${ instanceId }.${ ext }` );

            let result = null;
            let error  = false;

            // flag so no other process can use
            try {
                const { TagSet: currentTags } = await s3.getObjectTagging( {
                    Bucket: config.AWS_S3_BUCKET,
                    Key   : s3key
                } ).promise();

                const currentFlag = currentTags.find( tag => tag.Key === 'instance' );
                if ( currentFlag ) {
                    // todo: validate instance is still active
                    log( `SKIPPING: ${ requestId }` );
                    return;
                }

                await s3.putObjectTagging( {
                    Bucket : config.AWS_S3_BUCKET,
                    Key    : s3key,
                    Tagging: {
                        TagSet: [
                            {
                                Key  : "processing",
                                Value: instanceId
                            },
                            {
                                Key  : "start",
                                Value: Date.now().toString()
                            }
                        ]
                    }
                } ).promise();

                const { TagSet: newTags } = await s3.getObjectTagging( {
                    Bucket: config.AWS_S3_BUCKET,
                    Key   : s3key
                } ).promise();

                const newFlag = newTags.find( tag => tag.Key === 'processing' );
                if ( !newFlag || newFlag.Value !== instanceId ) {
                    log( `SKIPPING: ${ requestId }` );
                    return;
                }

            } catch ( err ) {
                log( 'flag-start-error', err );
                return true;
            }


            // process image
            try {
                const s3File = await s3.getObject( {
                    Bucket: config.AWS_S3_BUCKET,
                    Key   : s3key
                } ).promise();

                await fs.writeFile( localPath, s3File.Body );

                const { stdout } = await spawn( 'python3', [ 'image_classification.py', localPath ], {
                    cwd    : config.PYTHON_SCRIPT_DIR,
                    capture: [ 'stdout', 'stderr' ]
                } );

                result = stdout.toString();

            } catch ( err ) {
                if ( err.stderr ) {
                    //python error
                    log( 'python-error', err.stderr );
                }
                log( 'process-error', err );
                error = true;
            }


            // send message
            try {
                await sqs.sendMessage( {
                    MessageBody           : JSON.stringify( { result, requestId, error } ),
                    MessageDeduplicationId: requestId,
                    MessageGroupId        : 'output',
                    QueueUrl              : config.SQS_OUTPUT_URL
                } ).promise()
            } catch ( error ) {
                log( 'message', error );
            }


            try {
                await s3.putObjectTagging( {
                    Bucket : config.AWS_S3_BUCKET,
                    Key    : s3key,
                    Tagging: {
                        TagSet: [
                            {
                                Key  : "complete",
                                Value: Date.now().toString()
                            }
                        ]
                    }
                } ).promise();
            } catch ( error ) {
                log( 'flag-complete-error', error );
            }

            // cleanup
            try {
                await Promise.all( [
                    fs.unlink( localPath ),
                    s3.deleteObject( {
                        Bucket: config.AWS_S3_BUCKET,
                        Key   : s3key
                    } ).promise()
                ] );
            } catch ( err ) {
                log( 'cleanup-error', err );
            }


            setTimer();

            return true;
        },
    } );

    sqsConsumer.on( 'error', ( err ) => {
        logError( err.message );
    } );

    sqsConsumer.on( 'processing_error', ( err ) => {
        logError( err.message );
    } );

    setTimer();

    log( '-----STARTING PROCESSOR-----' );
    sqsConsumer.start();

} )();
