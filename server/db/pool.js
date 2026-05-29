'use strict';

const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

/**
 * Run a parameterised query against the pool.
 * @param {string} text  SQL statement
 * @param {any[]}  [params]  Positional parameters ($1, $2, …)
 * @returns {Promise<import('pg').QueryResult>}
 */
function query(text, params) {
  return pool.query(text, params);
}

module.exports = { pool, query };
