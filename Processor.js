const getConfig    = require( './config' );
const AWS          = require( 'aws-sdk' );
const { Consumer } = require( 'sqs-consumer' );
const uuid         = require( 'uuid' );
const fs           = require( 'fs' ).promises;
const spawn        = require( 'child-process-promise' ).spawn;
const { join }     = require( 'path' );

const s3   = new AWS.S3();
const sqs  = new AWS.SQS();
const ec2  = new AWS.EC2();
const meta = new AWS.MetadataService();

( async () => {
    const config = await getConfig();

    meta.request( "/latest/meta-data/instance-id", ( err, data ) => {
        console.log( data );

        //TODO: should come from Controller.js so the Controller can track if this processor is doing something or not
        const instanceId = uuid.v4();

        let timer = null;

        const sqsConsumer = Consumer.create( {
            sqs          : sqs,
            queueUrl     : config.sqsInputUrl,
            handleMessage: async ( message ) => {
                const { s3key, requestId } = JSON.parse( message.Body );

                if ( timer ) {
                    clearTimeout( timer );
                }

                console.log( `PROCESSING: ${ requestId }` );


                const ext       = s3key.split( '.' ).pop();
                const localPath = join( process.cwd(), `${ instanceId }.${ ext }` );

                let result = null;
                let error  = false;

                // flag so no other process can use
                try {
                    const { TagSet: currentTags } = await s3.getObjectTagging( {
                        Bucket: config.s3Bucket,
                        Key   : s3key
                    } ).promise();

                    const currentFlag = currentTags.find( tag => tag.Key === 'instance' );
                    if ( currentFlag ) {
                        // todo: validate instance is still active
                        console.log( `SKIPPING: ${ requestId }` );
                        return;
                    }

                    await s3.putObjectTagging( {
                        Bucket : config.s3Bucket,
                        Key    : s3key,
                        Tagging: {
                            TagSet: [
                                {
                                    Key  : "processing",
                                    Value: instanceId
                                },
                                {
                                    Key  : "start",
                                    Value: Date.now()
                                }
                            ]
                        }
                    } ).promise();

                    const { TagSet: newTags } = await s3.getObjectTagging( {
                        Bucket: config.s3Bucket,
                        Key   : s3key
                    } ).promise();

                    const newFlag = newTags.find( tag => tag.Key === 'processing' );
                    if ( !newFlag || newFlag.Value !== instanceId ) {
                        console.log( `SKIPPING: ${ requestId }` );
                        return;
                    }

                } catch ( err ) {
                    console.log( 'flag start', err );
                    return true;
                }


                // process image
                try {
                    const s3File = await s3.getObject( {
                        Bucket: config.s3Bucket,
                        Key   : s3key
                    } ).promise();

                    await fs.writeFile( localPath, s3File.Body );

                    const { stdout } = await spawn( 'python3', [ 'image_classification.py', localPath ], {
                        cwd    : config.SCRIPT_DIR,
                        capture: [ 'stdout', 'stderr' ]
                    } );
                    result           = stdout.toString();

                } catch ( err ) {
                    if ( err.stderr ) {
                        //python error
                        console.log( 'python', err.stderr );
                    }
                    console.log( 'process', err );
                    error = true;
                }


                // send message
                try {
                    await sqs.sendMessage( {
                        MessageBody           : JSON.stringify( { result, requestId, error } ),
                        MessageDeduplicationId: requestId,
                        MessageGroupId        : 'output',
                        QueueUrl              : config.sqsOutputUrl
                    } ).promise()
                } catch ( error ) {
                    console.log( 'message', error );
                }


                try {
                    await s3.putObjectTagging( {
                        Bucket : config.s3Bucket,
                        Key    : s3key,
                        Tagging: {
                            TagSet: [
                                {
                                    Key  : "complete",
                                    Value: Date.now()
                                }
                            ]
                        }
                    } ).promise();
                } catch ( error ) {
                    console.log( 'flag complete', error );
                }

                // cleanup
                try {
                    await Promise.all( [
                        fs.unlink( localPath ),
                        s3.deleteObject( {
                            Bucket: config.s3Bucket,
                            Key   : s3key
                        } ).promise()
                    ] );
                } catch ( err ) {
                    console.log( 'cleanup', err );
                }


                timer = setTimeout( async () => {
                    sqsConsumer.stop();
                    timer = null;
                    while ( true ) {
                        try {
                            await ec2.terminateInstances( {
                                InstanceIds: [ instanceId ]
                            } ).promise();
                        } catch ( err ) {
                        }

                        await new Promise( r => setTimeout( r, 2000 ) );
                    }
                }, 500000 );

                return true;
            },
        } );

        sqsConsumer.on( 'error', ( err ) => {
            console.error( err.message );
        } );

        sqsConsumer.on( 'processing_error', ( err ) => {
            console.error( err.message );
        } );

        sqsConsumer.start();
    } );
} )();