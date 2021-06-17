const { getBootScript } = require( './getBootScript' );

const config = require( './config' );
const AWS    = require( 'aws-sdk' );
const ec2    = new AWS.EC2();

const createApptier = async () => {

    const bootScript = await getBootScript( 'apptier' );

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

    await new Promise( r => setTimeout( r, 1000 ) );

    await ec2.createTags( {
        Resources: [ newInstanceId ], Tags: [
            {
                Key  : 'Status',
                Value: 'pending'
            },
            {
                Key  : 'Name',
                Value: 'apptier'
            }
        ]
    } ).promise();

};

module.exports.createApptier = createApptier;

switch ( process.argv[ 2 ] ) {
    case 'initiate':
        createApptier();
        break;
}
