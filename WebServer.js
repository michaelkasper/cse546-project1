const getConfig    = require( './config' );
const express      = require( 'express' );
const addRequestId = require( 'express-request-id' )();
const AWS          = require( 'aws-sdk' );
const multer       = require( 'multer' );
const multerS3     = require( 'multer-s3' );
const { Consumer } = require( 'sqs-consumer' );

const app = express();
const s3  = new AWS.S3();
const sqs = new AWS.SQS();

( async () => {
    const config = await getConfig();

    const log = ( message ) => {
        config.debug && console.log( message );
    }

    const logError = ( message ) => {
        config.debug && console.error( message );
    }

    const pendingResponses = {};
    const sqsConsumer      = Consumer.create( {
        sqs          : sqs,
        queueUrl     : config.sqsOutputUrl,
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
            bucket: config.s3Bucket,
            acl   : 'bucket-owner-full-control',
            key   : function ( req, file, cb ) {
                const ext = file.originalname.split( '.' ).pop();
                cb( null, `pending/${ req.id }.${ ext }` );
            }
        } )
    } );

    app.use( addRequestId );

    app.post( '/', upload.single( 'myfile' ), async ( req, res, next ) => {
        try {
            await sqs.sendMessage( {
                MessageBody           : JSON.stringify( {
                    s3key    : req.file.key,
                    requestId: req.id
                } ),
                MessageDeduplicationId: req.id,
                MessageGroupId        : 'input',
                QueueUrl              : config.sqsInputUrl
            } ).promise();

            log( `SENT: ${ req.id }` );
            pendingResponses[ req.id ] = res;
        } catch ( error ) {
            config.debug && console.log( error );
            res.send( "We ran into an error. Please try again." );
        }
    } );

    app.listen( config.WEB_PORT, config.WEB_HOSTNAME, function () {
        log( `Server running at http://${ config.WEB_HOSTNAME }:${ config.WEB_PORT }/` );
    } );

} )();
