const config            = require( './util/config' );
const { log, logError } = require( './util/log' );
const express           = require( 'express' );
const addRequestId      = require( 'express-request-id' )();
const AWS               = require( 'aws-sdk' );
const multer            = require( 'multer' );
const multerS3          = require( 'multer-s3' );
const { Consumer }      = require( 'sqs-consumer' );
const CurrentInstanceId = require( './util/CurrentInstanceId' );

const app = express();
const s3  = new AWS.S3();
const sqs = new AWS.SQS();
const ec2 = new AWS.EC2();


( async () => {

    const instanceId = await CurrentInstanceId();

    try {
        await ec2.createTags( {
            Resources: [ instanceId ], Tags: [
                {
                    Key  : 'status',
                    Value: 'ready'
                }
            ]
        } ).promise();
    } catch ( err ) {

    }

    const pendingResponses = {};
    const sqsConsumer      = Consumer.create( {
        sqs          : sqs,
        queueUrl     : config.SQS_OUTPUT_URL,
        handleMessage: async ( message ) => {
            const { result, requestId, error } = JSON.parse( message.Body );
            if ( requestId in pendingResponses ) {
                const res = pendingResponses[ requestId ];
                res.send( error ? "unknown error occurred" : result );
                delete pendingResponses[ requestId ];
            }
        },
    } );

    sqsConsumer.on( 'error', ( err ) => {
        logError( err.message );
    } );

    sqsConsumer.on( 'processing_error', ( err ) => {
        logError( err.message );
    } );

    sqsConsumer.start();


    const upload = multer( {
        storage: multerS3( {
            s3    : s3,
            bucket: config.AWS_S3_INPUT_BUCKET,
            acl   : 'bucket-owner-full-control',
            key   : function ( req, file, cb ) {
                const ext = file.originalname.split( '.' ).pop();
                cb( null, `pending/${ req.id }.${ ext }` );
            }
        } )
    } );

    app.use( addRequestId );

    app.post( '/', upload.single( 'myfile' ), async ( req, res, next ) => {
        req.setTimeout( 0 );
        try {
            await sqs.sendMessage( {
                MessageBody           : JSON.stringify( {
                    s3key    : req.file.key,
                    requestId: req.id
                } ),
                MessageDeduplicationId: req.id,
                MessageGroupId        : 'input',
                QueueUrl              : config.SQS_INPUT_URL
            } ).promise();

            log( `SENT: ${ req.id }` );
            pendingResponses[ req.id ] = res;
        } catch ( error ) {
            log( error );
            res.send( "We ran into an error. Please try again." );
        }
    } );

    app.listen( config.WEB_PORT, config.WEB_HOSTNAME, function () {
        log( '-----STARTING WEBAPP-----' );
        log( `Server running at http://${ config.WEB_HOSTNAME }:${ config.WEB_PORT }/` );
    } );


} )();
