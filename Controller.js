const config  = require( './util/config' );
const { log } = require( './util/log' );
const AWS     = require( 'aws-sdk' );
const fs      = require( 'fs' ).promises;

const s3  = new AWS.S3();
const sqs = new AWS.SQS();
const ec2 = new AWS.EC2();


while ( true ) {
    const sqsAttributes = await sqs.getQueueAttributes( {
        QueueUrl      : config.SQS_INPUT_URL,
        AttributeNames: [ 'ApproximateNumberOfMessages' ]
    } ).promise();


    const queueLength = sqsAttributes.Attributes.ApproximateNumberOfMessages;

    if ( queueLength > 0 ) {
        const instanceReservations = await ec2.describeInstances( {} ).promise();
        const instances            = instanceReservations.Reservations.map( reservation => reservation.Instances[ 0 ] );

        const processorInstances = instances.filter( instance => !!instance.Tags.find( tag => tag.Key === 'processor' ) );
        const activeInstances    = processorInstances.filter( instance => [ "pending", "running" ].includes( instance.State.Name ) );
        const stoppedInstances   = processorInstances.filter( instance => [ "stopping", "stopped" ].includes( instance.State.Name ) );

        let count = activeInstances;
        if ( count < queueLength ) {

            //boot stopped
            const toStart = [];
            while ( count < queueLength && count < 20 && stoppedInstances.length > 0 ) {
                toStart.push( stoppedInstances.pop().InstanceId );
                count++;
            }

            if ( toStart.length > 0 ) {
                await ec2.stopInstances( {
                    InstanceIds: []
                } );
            }


            //create ec2
            while ( count < queueLength && count < 20 ) {
                try {
                    const bootScript = await fs.readFile( 'scripts/processor.boot.sh', 'utf8' );

                    const result = await ec2.runInstances( {
                        ImageId           : config.AWS_EC2_AMI,
                        InstanceType      : 't2.micro',
                        IamInstanceProfile: {
                            Arn: "arn:aws:iam::415900791134:instance-profile/CSE546-Webapp"
                        },
                        MinCount          : 1,
                        MaxCount          : 1,
                        UserData          : Buffer.from( bootScript ).toString( 'base64' ),
                        KeyName           : config.AWS_EC2_KEYNAME,
                        SecurityGroupIds  : [ config.AWS_EC2_SECURITY_GROUPID ]
                    } ).promise();

                    const newInstanceId = result.Instances[ 0 ].InstanceId;

                    await ec2.createTags( {
                        Resources: [ newInstanceId ], Tags: [
                            {
                                Key  : 'processor',
                                Value: ''
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


    await new Promise( r => setTimeout( r, 500 ) );
}
