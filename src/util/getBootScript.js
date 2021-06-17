const fs       = require( 'fs' ).promises;
const { join } = require( 'path' );

const bootScripts = {};

module.exports.getBootScript = async ( script ) => {
    if ( !bootScripts[ script ] ) {
        const scriptPath      = join( process.cwd(), 'src', 'scripts', `${ script }.boot.sh` );
        bootScripts[ script ] = await fs.readFile( scriptPath, 'utf8' );
    }
    return bootScripts[ script ];
}

