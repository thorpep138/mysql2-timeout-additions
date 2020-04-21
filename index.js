module.exports.addTimeoutToPromisePool = ({ pool, seconds }) => {
    pool.getConnectionOriginal = pool.getConnection;

    pool.getConnection = async function() {
        try {
            const connection = await pool.getConnectionOriginal();
            const connectionHasBeenModifiedForTimeouts = connection.queryOriginal ? true : false;
            if (connectionHasBeenModifiedForTimeouts) {
                return connection;
            }
            connection.queryOriginal = connection.query;
            connection.query = async function() {
                try {
                    let queryTimedOut = false;
                    let threadId = null;
                    const timeoutId = setTimeout(() => {
                        if (typeof connection === "object" && connection !== null && connection.destroy) {
                            queryTimedOut = true;
                            threadId = connection.threadId || null;
                            connection.destroy();
                        }
                    }, seconds * 1000);
                    try {
                        const result = await connection.queryOriginal(...arguments);
                        if (queryTimedOut) {
                            if (threadId) {
                                try {
                                    await pool.query(`kill ${ threadId }`);
                                } catch (error) {
                                    // nothing to do here
                                }
                            }
                            throw new Error(`Query with arguments ${ JSON.stringify(arguments) } timed out.`);
                        }
                        clearTimeout(timeoutId);
                        return result;
                    } catch (queryError) {
                        clearTimeout(timeoutId);

                        if (typeof queryError === 'object' 
                            && queryError !== null 
                            && queryError.code === 'PROTOCOL_SEQUENCE_TIMEOUT'
                            && typeof connection === 'object' && connection !== null && connection.threadId) {
                                try {
                                    await pool.query(`kill ${ connection.threadId }`);
                                } catch (killError) {
                                    // nothing to do here
                                }
                        }

                        throw queryError;
                    }
                } catch (error) {
                    throw error;
                }
            };
            return connection;
        } catch (error) {
            throw error;
        }
    };

    pool.query = async function() {
        try {
            const connection = await pool.getConnection();
            const result = await connection.query(...arguments);
            await connection.release();
            return result;
        } catch (error) {
            try {
                if (typeof connection === "object" && connection !== null && connection.release) {
                    await connection.release();
                }
            } catch (releaseError) {
                // nothing to do here
            }

            throw error;
        }
    };
};