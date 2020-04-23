function TimeoutError(message) {
    this.name = 'TimeoutError';
    this.message = message;
    this.stack = (new Error()).stack;
};

TimeoutError.prototype.toString = function() {
    return `${ this.name }: ${ this.message }`;
}

function isClientTCPError(error) {
    return typeof error === 'object' 
        && error !== null 
        && error.code === 'PROTOCOL_SEQUENCE_TIMEOUT';
}

function queryInProgress(connection) {
    return typeof connection === 'object' 
        && connection !== null 
        && connection.threadId;
}

function canReleaseConnection(connection) {
    return typeof connection === "object" && connection !== null && connection.release;
}

module.exports.addTimeoutToPromisePool = ({ pool, seconds }) => {
    pool.getConnectionOriginal = pool.getConnection;

    pool.getConnection = async function() {
        try {
            const getConnectionTimeoutPromise = new Promise((resolve, reject) => {
                setTimeout(() => {
                    reject(new TimeoutError("getConnection timed out"));
                }, seconds * 1000);
            });
            
            const connection = await Promise.race([getConnectionTimeoutPromise, pool.getConnectionOriginal()]);
   
            const connectionHasBeenModifiedForTimeouts = connection.queryOriginal ? true : false;
            if (connectionHasBeenModifiedForTimeouts) {
                return connection;
            }

            connection.queryOriginal = connection.query;

            connection.query = async function() {
                try {
                    const queryTimeoutPromise = new Promise((resolve, reject) => {
                        setTimeout(() => {
                            reject(new TimeoutError(`Query with arguments ${ JSON.stringify(arguments) } timed out`));
                        }, seconds * 1000);
                    });

                    return await Promise.race([queryTimeoutPromise, connection.queryOriginal(...arguments)]);
                } catch (error) {
                    if ((isClientTCPError(error) && queryInProgress(connection)) || error instanceof TimeoutError) {
                        try {
                            await pool.query(`kill ${ connection.threadId }`);
                        } catch (killError) {
                            // nothing to do here
                        }
                    }

                    throw error;
                }
            };

            return connection;
        } catch (error) {
            throw error;
        }
    };

    pool.query = async function() {
        let connection;
        try {
            connection = await pool.getConnection();
            const result = await connection.query(...arguments);
            await connection.release();
            return result;
        } catch (error) {
            try {
                if (canReleaseConnection(connection)) {
                    await connection.release();
                }
            } catch (releaseError) {
                // nothing to do here
            }

            throw error;
        }
    };
};