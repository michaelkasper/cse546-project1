const AWS = require( 'aws-sdk' );

const {
          DEBUG,
          AWS_REGION,
          WEB_PORT,
          WEB_HOSTNAME,
          SQS_INPUT_URL,
          SQS_OUTPUT_URL,
          AWS_S3_BUCKET,
          AWS_EC2_WEBTIER_AMI,
          AWS_EC2_APPTIER_AMI,
          AWS_EC2_KEYNAME,
          AWS_EC2_WEB_SECURITY_GROUPID,
          AWS_EC2_PROCESSOR_SECURITY_GROUPID,
          AWS_EC2_IAM_PROFILE,
          PYTHON_SCRIPT_DIR
      } = process.env;

AWS.config.update( { region: AWS_REGION || 'us-east-1' } );

module.exports = {
    SQS_INPUT_URL,
    SQS_OUTPUT_URL,
    AWS_S3_BUCKET,
    AWS_EC2_WEBTIER_AMI,
    AWS_EC2_APPTIER_AMI,
    AWS_EC2_KEYNAME,
    AWS_EC2_WEB_SECURITY_GROUPID,
    AWS_EC2_PROCESSOR_SECURITY_GROUPID,
    AWS_EC2_IAM_PROFILE,
    PYTHON_SCRIPT_DIR,
    DEBUG       : DEBUG === "true",
    AWS_REGION  : AWS_REGION || 'us-east-1',
    WEB_PORT    : WEB_PORT || 3000,
    WEB_HOSTNAME: WEB_HOSTNAME || "0.0.0.0"
}
