import boto3
from threading import Timer
import time
import subprocess
from PIL import Image
from ec2_metadata import ec2_metadata

local_Path = "./Processed_images/natural_image.jpeg"
s3 = boto3.resource('s3')
sqs = boto3.resource('sqs')
ec2 = boto3.resource('ec2')

current_instance_id = ec2_metadata.instance_id
current_instance = ec2.Instance(current_instance_id)

input_queue = sqs.get_queue_by_name(QueueName='cse546-project1-input.fifo')
output_queue = sqs.get_queue_by_name(QueueName='cse546-project1-input.fifo')

input_bucket_name = "cse546-project1"
# for bucket in s3.buckets.all():
#     print(bucket.name)
output_bucket_name = "cse546-project1-outputs"
input_path = "/input/"
output_path = "/output/"
wait_flag = False

input_bucket = s3.Bucket(input_bucket_name)

def get_response():
    response = input_queue.receive_messages(
        AttributeNames=['All'],

        MaxNumberOfMessages=1,
        VisibilityTimeout=900,
        WaitTimeSeconds=1,
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
            response = instance.stop(
                    Force=True
                )

        wait_flag = False
        image_key = response.body["s3key"]
        request_id = response.body['request_id']
        image_name = image_key.split('.')[0]
        # image_object = input_bucket.Object(image_key)
        # res = image_object.get()
        # file_stream = res["Body"]
        # im = Image.open(file_stream)
        input_bucket.download_file(image_key,local_Path)
        predicted_class = subprocess.check_output(['python','image_classification.py',local_Path]).strip().decode("ascii")

        #send output class to response queue


        #send output class to S3 output bucket
