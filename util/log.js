const config = require( './config' );

module.exports = {
    log     : ( ...args ) => {
        config.DEBUG && console.log( ...args );
    },
    logError: ( ...args ) => {
        config.DEBUG && console.error( ...args );
    }
}
