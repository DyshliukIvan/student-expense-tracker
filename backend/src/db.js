const { Pool } = require("pg");

const pool = new Pool({
    host: "localhost",
    port: 5432,
    user: "app",
    password: "app",
    database: "expenses"
});

module.exports = pool;