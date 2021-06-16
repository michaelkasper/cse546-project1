import json
import ntpath
import os
import pprint
import subprocess
import time
from threading import Timer

import boto3
from dotenv import dotenv_values
from ec2_metadata import ec2_metadata

pp = pprint.PrettyPrinter(indent=4)

sqs = boto3.client('sqs', region_name='us-east-1')
ec2 = boto3.client('ec2', region_name='us-east-1')
s3 = boto3.client('s3', region_name='us-east-1')

config = {
    **dotenv_values(".env"),
    **dotenv_values(".env.local"),
}

try:
    current_instance_id = ec2_metadata.instance_id
except:
    current_instance_id = None

timerLength = 20
sleepLength = 2
running = True


def timerEnd():
    global running
    running = False


def get_response():
    response = sqs.receive_message(
        QueueUrl=config['SQS_INPUT_URL'],
        AttributeNames=[
            'SentTimestamp'
        ],
        MaxNumberOfMessages=1,
        MessageAttributeNames=[
            'All'
        ]
    )
    return response


if __name__ == "__main__":
    theTimer = Timer(timerLength, timerEnd, ())
    theTimer.start()

    while (running):
        response = get_response()

        if ('Messages' in response):
            theTimer.cancel()
            pp.pprint("----Computing----")
            wait_flag = False
            message = json.loads(response['Messages'][0]['Body'])
            image_key = message['s3key']
            request_id = message['requestId']
            local_name = ntpath.basename(image_key)
            image_name = ntpath.basename(image_key).split('.')[0]  # TODO: Potention issue if file name has a dot in it

            with open(local_name, 'wb') as f:
                s3.download_fileobj(config['AWS_S3_INPUT_BUCKET'], image_key, f)

            predicted_class = subprocess.check_output(
                ['python3', 'image_classification.py',
                 os.path.abspath(local_name)], cwd=config['PYTHON_SCRIPT_DIR']).strip().decode(
                "ascii")

            os.remove(local_name)

            # send output class to response queue
            sqs.send_message(
                QueueUrl=config['SQS_OUTPUT_URL'],
                MessageGroupId="OutMessage",
                MessageDeduplicationId=request_id,
                MessageBody=json.dumps({
                    'pred_class': predicted_class,
                    'request_id': request_id
                })
            )

            # send output class to S3 output bucket
            s3.put_object(
                Body='(' + image_name + ', ' + predicted_class + ')',
                Bucket=config['AWS_S3_OUTPUT_BUCKET'],
                Key=image_name
            )

            # deleting the message from input queue
            sqs.delete_message(
                QueueUrl=config['SQS_INPUT_URL'],
                ReceiptHandle=response['Messages'][0]['ReceiptHandle']
            )

            theTimer = Timer(timerLength, timerEnd, ())
            theTimer.start()
        else:
            pp.pprint("----No Message----")
            time.sleep(sleepLength)

if current_instance_id is not None:
    response = ec2.stop_instances(
        InstanceIds=[
            current_instance_id,
        ],
        Force=True
    )
