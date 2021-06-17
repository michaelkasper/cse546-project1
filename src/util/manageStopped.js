const moment  = require( "moment" );
const { log } = require( "./log" );
const stopped = {};

module.exports.manageStopped = async ( ec2, stoppedInstances ) => {

    const toTerminate = [];

    stoppedInstances.forEach( instance => {
        if ( !stopped[ instance.InstanceId ] ) {
            stopped[ instance.InstanceId ] = Date.now();
        }

        //if stopped for 1 hour or more, terminate
        if ( moment( stopped[ instance.InstanceId ] ).isBefore( moment().subtract( 1, 'hours' ) ) ) {
            toTerminate.push( instance.InstanceId );
            delete stopped[ instance.InstanceId ];
        }
    } );

    if ( toTerminate.length > 0 ) {
        await ec2.terminateInstances( {
            InstanceIds: toTerminate
        } ).promise();
        log( 'Terminating: ', toTerminate.length );
    }
}
