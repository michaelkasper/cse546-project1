require( 'dotenv' ).config();

const AWS    = require( 'aws-sdk' );
const fs     = require( 'fs' ).promises;
const config = require( './config' );

AWS.config.update( { region: config.AWS_REGION } );

const s3  = new AWS.S3();
const sqs = new AWS.SQS();
const ec2 = new AWS.EC2();

( async () => {
    while ( true ) {
        const sqsAttributes = await sqs.getQueueAttributes( {
            QueueUrl      : config.sqsInputUrl,
            AttributeNames: [ 'ApproximateNumberOfMessages' ]
        } ).promise();

        const queueLength = sqsAttributes.Attributes.ApproximateNumberOfMessages;
        if ( queueLength > 0 ) {
            const instanceReservations = await ec2.describeInstances( {} ).promise();
            const instances            = instanceReservations.Reservations[ 0 ].Instances;

            const processorInstances = instances.filter( instance => !!instance.Tags.find( tag => tag.Key === 'processor' ) );

            if ( processorInstances < queueLength ) {
                //create ec2
                const bootScript    = await fs.readFile( '/etc/hosts', 'utf8' );
                const result        = await ec2.runInstances( {
                    ImageId           : 'AMI_ID',
                    InstanceType      : 't2.micro',
                    IamInstanceProfile: "arn:aws:iam::415900791134:instance-profile/CSE546-Webapp",
                    MinCount          : 1,
                    MaxCount          : 1,
                    UserData          : new Buffer( bootScript ).toString( 'base64' )
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
            }
        }


        const pendingImages = await s3.listObjectsV2( {
            Bucket: config.s3Bucket,
            Prefix: "pending/"
        } ).promise();

        console.log( pendingImages );


        await new Promise( r => setTimeout( r, 100 ) );
    }
} )()
