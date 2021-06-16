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

    let count        = 0;
    const pending    = {};
    const addPending = ( requestId, response, i ) => {
        const sqsConsumer = Consumer.create( {
            sqs          : sqs,
            queueUrl     : config.SQS_OUTPUT_URL,
            handleMessage: async ( message ) => {
                const { pred_class, request_id, error } = JSON.parse( message.Body );
                if ( request_id in pending ) {
                    const res = pending[ request_id ].response;
                    console.log( 'completing:', pending[ request_id ].i );
                    res.send( error ? "unknown error occurred" : pred_class );
                    delete pending[ request_id ];
                    sqsConsumer.stop();
                    return true;
                }
                return false;
            },
        } );

        sqsConsumer.on( 'error', ( err ) => {
            logError( err.message );
        } );

        sqsConsumer.on( 'processing_error', ( err ) => {
            logError( err.message );
        } );

        pending[ requestId ] = { response, i };
        sqsConsumer.start();
    }


    const upload = multer( {
        storage: multerS3( {
            s3    : s3,
            bucket: config.AWS_S3_INPUT_BUCKET,
            acl   : 'bucket-owner-full-control',
            key   : function ( req, file, cb ) {
                cb( null, file.originalname );
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
            addPending( req.id, res, ++count );
        } catch ( error ) {
            log( error );
            res.send( "We ran into an error. Please try again." );
        }
    } );

    app.listen( config.WEB_PORT, config.WEB_HOSTNAME, () => {
        log( '-----STARTING WEBAPP-----' );
        log( `Server running at http://${ config.WEB_HOSTNAME }:${ config.WEB_PORT }/` );

        try {
            ec2.createTags( {
                Resources: [ instanceId ], Tags: [
                    {
                        Key  : 'Status',
                        Value: 'ready'
                    }
                ]
            } ).promise();
        } catch ( err ) {

        }

    } );


} )();
