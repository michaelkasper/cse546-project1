module.exports = {
    ...process.env,
    sqsInputUrl : "https://sqs.us-east-1.amazonaws.com/415900791134/cse546-project1-input.fifo",
    sqsOutputUrl: "https://sqs.us-east-1.amazonaws.com/415900791134/cse546-project1-output.fifo",
    s3Bucket    : 'cse546-project1',
};
