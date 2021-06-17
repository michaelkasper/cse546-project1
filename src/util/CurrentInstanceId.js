const config = require( './config' );
const AWS    = require( 'aws-sdk' );

const meta = new AWS.MetadataService();


module.exports = async () => {
    return new Promise( ( resolve, reject ) => {
        if ( config.ENV === 'LOCAL' ) {
            resolve( null );
            return;
        }

        meta.request( "/latest/meta-data/instance-id", ( err, data ) => {
            resolve( err ? null : data );
        } );
    } )
}
