require( 'config' );
const uuid = require( 'uuid' );
const AWS  = require( 'aws-sdk' );

const meta = new AWS.MetadataService();


module.exports = async () => {
    return new Promise( ( resolve, reject ) => {
        meta.request( "/latest/meta-data/instance-id", ( err, data ) => {
            resolve( err ? uuid.v4() : data );
        } );
    } )
}
