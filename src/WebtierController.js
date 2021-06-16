const config   = require( './util/config' );
const { log }  = require( './util/log' );
const AWS      = require( 'aws-sdk' );
const fs       = require( 'fs' ).promises;
const { join } = require( 'path' );

const sqs = new AWS.SQS();
const ec2 = new AWS.EC2();

( async () => {

    log( '-----STARTING CONTROLLER-----' );

    const scriptPath   = join( process.cwd(), 'src', 'scripts', 'processor.boot.sh' );
    const bootScript   = await fs.readFile( scriptPath, 'utf8' );
    const stopLog      = {};
    let toStart        = [];
    let toTerminate    = [];
    let delaySeconds   = 2;
    let noMessageCount = 0;

    while ( true ) {
        toStart = [];

        const sqsAttributes = await sqs.getQueueAttributes( {
            QueueUrl      : config.SQS_INPUT_URL,
            AttributeNames: [ 'ApproximateNumberOfMessages' ]
        } ).promise();

        const queueLength          = sqsAttributes.Attributes.ApproximateNumberOfMessages;
        const instanceReservations = await ec2.describeInstances( {} ).promise();
        const instances            = instanceReservations.Reservations.map( reservation => reservation.Instances[ 0 ] );

        const processorInstances = instances.filter( instance => !!instance.Tags.find( tag => tag.Key === 'Name' && tag.Value === 'apptier' ) );
        const activeInstances    = processorInstances.filter( instance => [ "pending", "running" ].includes( instance.State.Name ) );
        const stoppedInstances   = processorInstances.filter( instance => [ "stopping", "stopped" ].includes( instance.State.Name ) && !toTerminate.includes( instance.InstanceId ) );

        if ( queueLength > 0 ) {
            noMessageCount = 0;
            delaySeconds   = 2;
            let count      = activeInstances.length;
            if ( count < queueLength ) {

                //boot stopped
                while ( count < queueLength && count <= 20 && stoppedInstances.length > 0 ) {
                    const instanceId = stoppedInstances.pop().InstanceId;
                    toStart.push( instanceId );
                    delete stopLog[ instanceId ];
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
                while ( count < queueLength && count <= 20 ) {
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
                                    Value: 'apptier'
                                }
                            ]
                        } ).promise();

                        count++;
                    } catch ( err ) {
                        log( 'create', err )
                    }
                }
            }
        } else {
            noMessageCount++;
        }


        toTerminate = [];
        stoppedInstances.filter( instance => !toStart.includes( instance.InstanceId ) ).forEach( instance => {
            if ( !stopLog[ instance.InstanceId ] ) {
                stopLog[ instance.InstanceId ] = Date.now();
            }

            //if ideal for 2 hours or more, terminate
            const HOUR = 1000 * 60 * 60;
            if ( stopLog[ instance.InstanceId ] < Date.now() - ( 2 * HOUR ) ) {
                toTerminate.push( instance.InstanceId );
                delete stopLog[ instance.InstanceId ];
            }

            if ( toTerminate.length > 0 ) {
                ec2.terminateInstances( {
                    InstanceIds: toTerminate
                } ).promise();
            }
        } )


        //every ten minutes we double the delay time
        if ( noMessageCount > 0 && noMessageCount % 300 === 0 ) {
            if ( delaySeconds < 256 ) {// max delay 4.2 min
                delaySeconds = delaySeconds * delaySeconds;
            }
        }

        await new Promise( r => setTimeout( r, delaySeconds * 1000 ) );
    }
} )()
