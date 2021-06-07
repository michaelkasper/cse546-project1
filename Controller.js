const getConfig = require( './config' );
const AWS       = require( 'aws-sdk' );
const fs        = require( 'fs' ).promises;

const s3  = new AWS.S3();
const sqs = new AWS.SQS();
const ec2 = new AWS.EC2();

( async () => {

    const config = await getConfig();

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

            if ( processorInstances.length < queueLength ) {
                //create ec2
                try {
                    const bootScript = await fs.readFile( 'scripts/processor.boot.sh', 'utf8' );

                    const result = await ec2.runInstances( {
                        ImageId           : config.ami,
                        InstanceType      : 't2.micro',
                        IamInstanceProfile: {
                            Arn: "arn:aws:iam::415900791134:instance-profile/CSE546-Webapp"
                        },
                        MinCount          : 1,
                        MaxCount          : 1,
                        UserData          : Buffer.from( bootScript ).toString( 'base64' )
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

                } catch ( err ) {
                    config.debug && console.log( 'create', err )
                }

            }
        }


        // const pendingImages = await s3.listObjectsV2( {
        //     Bucket: config.s3Bucket,
        //     Prefix: "pending/"
        // } ).promise();
        //
        // config.debug && console.log( pendingImages );


        await new Promise( r => setTimeout( r, 100 ) );
    }
} )()
