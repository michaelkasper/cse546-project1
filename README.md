# CSE 546: Project1

----------------------------------------

- Michael Kasper
- Chandraveer Singh
- Daniel Mathew

----------------------------------------

## AWS

#### AWS Access

    `See AWS_CREDENTIALS file`

#### SQS Input URL:

    `https://sqs.us-east-1.amazonaws.com/415900791134/cse546-project1-input`

#### SQS Output URL:

    `https://sqs.us-east-1.amazonaws.com/415900791134/cse546-project1-output`

#### Input Bucket:

    `cse546-project1-inputs`

#### Output Bucket:

    `cse546-project1-outputs`

# Running/Testing

### Public DNS (Current active Webtier)

    `ec2-52-205-165-179.compute-1.amazonaws.com`

___If this is offline for any reason you can create a new webtier using a command line tool___

### CLI Tool To Start New Webtier

#### Install/Setup

- Rename the `.env.local.dist` file to `.env.local`
- Add AWS credentials to the `.env.local` file

#### Running

From root of code base run:

    npm install
    npm run create-web



