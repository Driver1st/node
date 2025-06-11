const { Pool } = require("pg");
const { nanoid } = require("nanoid");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/timersdb",
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  nanoid,
};
