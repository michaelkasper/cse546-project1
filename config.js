require( 'dotenv' ).config();
const AWS = require( 'aws-sdk' );

AWS.config.update( { region: 'us-east-1' } );

const ssm = new AWS.SSM();

module.exports = async () => {
    const data = await ssm.getParameters( {
        Names: [
            '/cse546/ami',
            '/cse546/s3Bucket',
            '/cse546/scriptDir',
            '/cse546/sqsInputUrl',
            '/cse546/sqsOutputUrl',
            '/cse546/securityGroupId',
            '/cse546/keyName',
            '/cse546/debug'
        ]
    } ).promise();

    const awsParams = data.Parameters.reduce( ( acc, param ) => ( {
        ...acc,
        [ param.Name.split( '/' ).pop() ]: param.Value
    } ), {} );

    awsParams[ 'debug' ] = awsParams[ 'debug' ] === "true"

    return {
        debug: false,
        ...awsParams,
        ...process.env,
        WEB_PORT    : 3000,
        WEB_HOSTNAME: "0.0.0.0"
    };
}
