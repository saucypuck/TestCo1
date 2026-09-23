require('dotenv').config();
const { Pool } = require('pg');

const pool = process.env.DATABASE_URL
  ? new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
  : null;

if (!pool) {
  console.warn('DATABASE_URL is not set — /api routes will return 500 until it is configured.');
}

module.exports = {
  query: (text, params) => {
    if (!pool) return Promise.reject(new Error('DATABASE_URL is not configured'));
    return pool.query(text, params);
  },
};
