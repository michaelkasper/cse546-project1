const config = require( './config' );
const AWS    = require( 'aws-sdk' );
const fs     = require( 'fs' ).promises;

const ec2 = new AWS.EC2();


( async () => {
    const bootScript = await fs.readFile( 'scripts/processor.boot.sh', 'utf8' );

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
            },
        ]
    } ).promise();

} )();
