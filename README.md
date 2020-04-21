# mysql2-timeout-additions
Provides timeout functionality for the `mysql2` module (see https://github.com/sidorares/node-mysql2)

# About
Many users of the `mysql2` module find themselves having to implement custom timeout handlers for their queries. This involves cleaning up the connection when the timeout has been exceeded, writing a routine to kill the database query itself when the timeout is exceeded (which does not happen automatically as a result of closing the connection), and handling tcp errors on the client side. 

It has been a heavily requested feature for the `mysql2` project, but the maintainers have decided that timeout functionality is beyond the scope of the database driver as per https://github.com/sidorares/node-mysql2/issues/185. 

This module allows you to specify a `timeout` parameter for `promise pools` created by `mysql2` which will enhance all subsequent invocations to `pool.query` and `connection.query` to throw an error when the timeout threshold has been exceeded. This module will also seamlessly handle terminating the associated database queries and handle tcp connection errors on the client side in a way that ensures database queries are cleaned up after the client connection is terminated.

## Install
```
$ npm install mysql2-timeout-additions
```

## Usage
```javascript
const mysql = require('mysql2');
const mysql2Timeout = require('mysql2-timeout-additions');
const MAX_QUERY_EXECUTION_TIME_SECONDS = 5;

const pool = mysql.createPool({
    connectionLimit : 10,
    host            : "myHost",
    user            : "myUser",
    password    : "myPassword",
    database     : "myDatabase"
});
const promisePool = pool.promise();

mysql2Timeout.addTimeoutToPromisePool({ 
    pool: promisePool, 
    seconds: MAX_QUERY_EXECUTION_TIME_SECONDS 
});
```

Now whenever a query takes longer than the specified number of seconds to execute, it will throw an error message that contains the offending query as a substring. Timeout functionality is added seamlessly to any invocations to `pool.query` as well as any invocations to `connection.query` on any connections acquired through `pool.getConnection`. 

This module handles both cleaning up the connection object and returning it to the pool whenever a connection runs overtime, as well as killing the database query itself. It also handles killing the database query when the tcp socket on the client side fails by listening for the `PROTOCOL_SEQUENCE_TIMEOUT` error. 

## Requirements
Requires node >= 7.6

## Limitations
Right now this module only supports adding timeout functionality to `promise pools` created by `mysql2`. 

## Todo 
- Add timeout functions for `mysql2` objects besides `promise pools`. 
- Add tests.
