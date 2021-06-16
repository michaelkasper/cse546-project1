const config   = require( './config' );
const { join } = require( 'path' );

console.log( join( process.cwd(), 'src', 'scripts', 'webserver.boot.sh' ) );

module.exports = {
    log     : ( ...args ) => {
        config.DEBUG && console.log( ...args );
    },
    logError: ( ...args ) => {
        config.DEBUG && console.error( ...args );
    }
}
