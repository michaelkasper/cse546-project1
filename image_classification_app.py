import boto3
from threading import Timer
import time
import subprocess
from PIL import Image
from ec2_metadata import ec2_metadata
import os

local_Path = "./Processed_images/natural_image.jpeg"
s3 = boto3.resource('s3')
sqs = boto3.resource('sqs')
ec2 = boto3.resource('ec2')

sqs_client = boto3.client('sqs')

current_instance_id = ec2_metadata.instance_id
current_instance = ec2.Instance(current_instance_id)

input_queue = sqs.get_queue_by_name(QueueName='cse546-project1-input.fifo')
output_queue = sqs.get_queue_by_name(QueueName='cse546-project1-output.fifo')

input_queue_url= "https://sqs.us-east-1.amazonaws.com/415900791134/cse546-project1-input.fifo"
output_queue_url = "https://sqs.us-east-1.amazonaws.com/415900791134/cse546-project1-output.fifo"

input_bucket_name = "cse546-project1"
output_bucket_name = "cse546-project1-outputs"

# input_path = "/"
# output_path = "/"

wait_flag = False

input_bucket = s3.Bucket(input_bucket_name)
output_bucket = s3.Bucket(output_bucket_name)


def get_response():
    response = sqs.receive_message(
        QueueUrl=input_queue_url,
        AttributeNames=[
            'SentTimestamp'
        ],
        MaxNumberOfMessages=1,
        MessageAttributeNames=[
            'All'
        ],
        VisibilityTimeout=90,
        WaitTimeSeconds=0
    )
    return response

if __name__ == "__main__":
    while(True):
        response = get_response()

        print(response)
        break
        if (response == [] and wait_flag==False):
            wait_flag = True
            time.sleep(60)
            continue
        elif (response == [] and wait_flag ==True):
            # subprocess.call(["halt"])
            # response = instance.stop(
            #         Force=True
            #     )

        wait_flag = False
        image_key = response['Messages'][0]['Body']['s3key']
        request_id = response['Messages'][0]['Body']['requestId']

        image_name = image_key.split('.')[0]
        # image_object = input_bucket.Object(image_key)
        # res = image_object.get()
        # file_stream = res["Body"]
        # im = Image.open(file_stream)
        input_bucket.download_file(image_key,local_Path)
        predicted_class = subprocess.check_output(['python','image_classification.py',local_Path]).strip().decode("ascii")

        #send output class to response queue
        response = client.send_message(
            QueueUrl=output_queue_url,
            MessageBody={
            'pred_class': predicted_class,
            'request_id': request_id
            }
        )



        #send output class to S3 output bucket
        result = (image_name,predicted_class)
        object = output_bucket.put_object(Body=result,Key=image_name)

        #deleting the message from input queue
        receipt_handle = response['Messages'][0]['ReceiptHandle']
        response = client.delete_message(
            QueueUrl=input_queue_url,
            ReceiptHandle=receipt_handle
        )
