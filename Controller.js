const config   = require( './util/config' );
const { log }  = require( './util/log' );
const AWS      = require( 'aws-sdk' );
const fs       = require( 'fs' ).promises;
const { join } = require( 'path' );

const s3  = new AWS.S3();
const sqs = new AWS.SQS();
const ec2 = new AWS.EC2();

( async () => {

    log( '-----STARTING CONTROLLER-----' );

    const scriptPath = join( process.cwd(), 'scripts', 'processor.boot.sh' );
    const bootScript = await fs.readFile( scriptPath, 'utf8' );

    while ( true ) {
        const sqsAttributes = await sqs.getQueueAttributes( {
            QueueUrl      : config.SQS_INPUT_URL,
            AttributeNames: [ 'ApproximateNumberOfMessages' ]
        } ).promise();

        const queueLength = sqsAttributes.Attributes.ApproximateNumberOfMessages;

        if ( queueLength > 0 ) {
            const instanceReservations = await ec2.describeInstances( {} ).promise();
            const instances            = instanceReservations.Reservations.map( reservation => reservation.Instances[ 0 ] );

            const processorInstances = instances.filter( instance => !!instance.Tags.find( tag => tag.Key === 'Name' && tag.Value === 'processor' ) );
            const activeInstances    = processorInstances.filter( instance => [ "pending", "running" ].includes( instance.State.Name ) );
            const stoppedInstances   = processorInstances.filter( instance => [ "stopping", "stopped" ].includes( instance.State.Name ) );

            let count = activeInstances.length;
            if ( count < queueLength ) {

                //boot stopped
                const toStart = [];
                while ( count < queueLength && count < 20 && stoppedInstances.length > 0 ) {
                    toStart.push( stoppedInstances.pop().InstanceId );
                    count++;
                }

                try {
                    if ( toStart.length > 0 ) {
                        const r = await ec2.startInstances( {
                            InstanceIds: toStart
                        } ).promise();
                    }
                } catch ( err ) {
                    log( 'start', err )
                }

                //create ec2
                while ( count < queueLength && count < 20 ) {
                    try {
                        const result = await ec2.runInstances( {
                            ImageId           : config.AWS_EC2_AMI,
                            InstanceType      : 't2.micro',
                            IamInstanceProfile: {
                                Arn: config.AWS_EC2_IAM_PROFILE
                            },
                            MinCount          : 1,
                            MaxCount          : 1,
                            UserData          : Buffer.from( bootScript ).toString( 'base64' ),
                            KeyName           : config.AWS_EC2_KEYNAME,
                            SecurityGroupIds  : [ config.AWS_EC2_PROCESSOR_SECURITY_GROUPID ]
                        } ).promise();

                        const newInstanceId = result.Instances[ 0 ].InstanceId;

                        await ec2.createTags( {
                            Resources: [ newInstanceId ], Tags: [
                                {
                                    Key  : 'Name',
                                    Value: 'processor'
                                }
                            ]
                        } ).promise();

                        count++;
                    } catch ( err ) {
                        log( 'create', err )
                    }
                }
            }
        }


        // const pendingImages = await s3.listObjectsV2( {
        //     Bucket: config.s3Bucket,
        //     Prefix: "pending/"
        // } ).promise();
        //
        // log( pendingImages );


        await new Promise( r => setTimeout( r, 5000 ) );
    }
} )()
