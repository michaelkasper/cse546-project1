const { getBootScript } = require( './getBootScript' );

const config = require( './config' );
const AWS    = require( 'aws-sdk' );
const ec2    = new AWS.EC2();

const createWebtier = async () => {

    const bootScript = await getBootScript( 'webtier' );

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
        SecurityGroupIds  : [ config.AWS_EC2_WEB_SECURITY_GROUPID ]
    } ).promise();

    const newInstanceId = result.Instances[ 0 ].InstanceId;

    await new Promise( r => setTimeout( r, 10000 ) );

    await ec2.createTags( {
        Resources: [ newInstanceId ], Tags: [
            {
                Key  : 'Status',
                Value: 'pending'
            },
            {
                Key  : 'Name',
                Value: `${ config.EC2_INSTANT_TYPE_WEB }1`
            },
            {
                Key  : 'Type',
                Value: config.EC2_INSTANT_TYPE_WEB
            },
        ]
    } ).promise();

    return newInstanceId;
};

module.exports.createWebtier = createWebtier;


( async () => {
    switch ( process.argv[ 2 ] ) {
        case 'initiate':
            const newInstanceId = await createWebtier();

            const details      = { InstanceId: newInstanceId, PublicDnsName: 'unknown' };
            let foundPublicDNS = false;
            let tries          = 0;
            while ( !foundPublicDNS && tries < 10 ) {
                await new Promise( r => setTimeout( r, 50000 ) );

                const instanceDetails = await ec2.describeInstances( {
                    InstanceIds: [ newInstanceId ]
                } ).promise();

                const instance = instanceDetails.Reservations[ 0 ].Instances[ 0 ];

                if ( instance.PublicDnsName !== '' ) {
                    foundPublicDNS        = true;
                    details.PublicDnsName = instance.PublicDnsName;
                }
                tries++;
            }

            console.log( '-----WEBTIER CREATED-----' );
            console.log( details );

            break;
    }

} )()
