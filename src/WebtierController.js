const config            = require( './util/config' );
const { log }           = require( './util/log' );
const { createApptier } = require( './util/createApptier' );
const { manageStalled } = require( './util/manageStalled' );
const { manageStopped } = require( './util/manageStopped' );
const AWS               = require( 'aws-sdk' );

const sqs = new AWS.SQS();
const ec2 = new AWS.EC2();

( async () => {

    log( '-----STARTING CONTROLLER-----' );

    /**
     * Cool-down timer so controller can go into an idol state if no traffic.
     * need to be rest {setTimer();} whenever queueLength > 0
     */
    // let timer        = null;
    //
    // const setTimer = () => {
    //     if ( timer ) {
    //         clearInterval( timer );
    //     }
    //
    //     delaySeconds = 2;
    //     timer        = setInterval( () => {
    //         if ( delaySeconds < 256 ) {// max delay 4.2 min
    //             delaySeconds = delaySeconds * delaySeconds;
    //         } else {
    //             clearInterval( timer );
    //             timer = null;
    //         }
    //     }, 600 * 1000 );// every ten minutes
    // }
    //
    // setTimer();
    /**
     *
     */

    let delaySeconds = 2;
    while ( true ) {

        const sqsAttributes = await sqs.getQueueAttributes( {
            QueueUrl      : config.SQS_INPUT_URL,
            AttributeNames: [ 'ApproximateNumberOfMessages' ]
        } ).promise();

        const queueLength          = sqsAttributes.Attributes.ApproximateNumberOfMessages;
        const instanceReservations = await ec2.describeInstances( {} ).promise();
        const instances            = instanceReservations.Reservations.map( reservation => reservation.Instances[ 0 ] ).filter( instance => [ "pending", "running", "stopping", "stopped" ].includes( instance.State.Name ) );

        const apptierInstances = instances.filter( instance => !!instance.Tags.find( tag => tag.Key === 'Type' && tag.Value === config.EC2_INSTANT_TYPE_APP ) );
        const activeInstances  = apptierInstances.filter( instance => [ "pending", "running" ].includes( instance.State.Name ) );
        const stoppedInstances = apptierInstances.filter( instance => [ "stopping", "stopped" ].includes( instance.State.Name ) );
        const toStart          = [];
        const openIndexes      = [ ...Array( 21 ).keys() ].slice( 1 ).filter( index => !apptierInstances.find( instance => !!instance.Tags.find( tag => tag.Key === 'Name' && tag.Value === `${ config.EC2_INSTANT_TYPE_APP }${ index }` ) ) );

        if ( queueLength > 0 ) {
            let apptierCount = apptierInstances.length;
            let activeCount  = activeInstances.length;

            if ( activeCount < queueLength ) {
                const promises = []

                //boot stopped
                while ( activeCount < queueLength && stoppedInstances.length > 0 ) {
                    const instance = stoppedInstances.pop();
                    toStart.push( instance.InstanceId );
                    activeCount++;
                }

                try {
                    if ( toStart.length > 0 ) {
                        promises.push(
                            ec2.startInstances( {
                                InstanceIds: toStart
                            } ).promise()
                        );
                        log( 'starting: ', toStart.length );
                    }
                } catch ( err ) {
                    log( 'start', err )
                }

                //create ec2
                while ( activeCount < queueLength && apptierCount < 20 ) {
                    try {
                        promises.push( createApptier( openIndexes.shift() ) );
                        log( 'creating new' );
                        activeCount++;
                        apptierCount++;
                    } catch ( err ) {
                        log( 'create', err )
                    }
                }

                await Promise.all( promises.map( p => p.catch( e => e ) ) );
            }
        }

        await manageStalled( ec2, activeInstances );

        await manageStopped( ec2, stoppedInstances );

        await new Promise( r => setTimeout( r, delaySeconds * 1000 ) );
    }
} )()
