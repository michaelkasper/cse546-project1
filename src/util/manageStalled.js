const moment  = require( "moment" );
const { log } = require( "./log" );
const pending = {};


module.exports.manageStalled = async ( ec2, instances ) => {

    const toTerminate      = [];
    const pendingInstances = instances.filter( instance => [ "pending" ].includes( instance.State.Name ) );
    const newPending       = {};

    pendingInstances.forEach( instance => {
        newPending[ instance.InstanceId ] = !pending[ instance.InstanceId ] ? Date.now() : pending[ instance.InstanceId ];

        //if stalled for 5 minutes or more, terminate
        if ( moment( newPending[ instance.InstanceId ] ).isBefore( moment().subtract( 5, 'minutes' ) ) ) {
            toTerminate.push( instance.InstanceId );
        }
    } );

    if ( toTerminate.length > 0 ) {
        await ec2.terminateInstances( {
            InstanceIds: toTerminate
        } ).promise();
        log( 'Terminating Stalled: ', toTerminate.length );
    }

    for ( let key in pending ) {
        delete pending[ key ];
    }

    Object.assign( pending, newPending );
}
