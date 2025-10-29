// src/config/db.js
const mysql = require('mysql2/promise');
let pool;

async function initPool() {
  if (pool) return pool;

    const sslEnabled = String(process.env.DB_SSL).toLowerCase() === 'true';
  const sslConfig = sslEnabled
    ? (process.env.DB_CA ? { ca: process.env.DB_CA } : { rejectUnauthorized: true })
    : undefined;

  pool = await mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    port: Number(process.env.DB_PORT || 3306),
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    namedPlaceholders: true,
    timezone: 'Z',
    ssl: sslConfig
  });

  // ===== SHIM request/input/query =====
  pool.request = function request() {
    const params = {};
    return {
      input(name, _type, value) {
        if (arguments.length === 2) value = _type; // permitir .input('name', value)
        params[name] = value;
        return this;
      },
      async query(sqlText) {
        const sqlConv = sqlText.replace(/@([a-zA-Z0-9_]+)/g, ':$1');
        const [rows, meta] = await pool.execute(sqlConv, params);
        return {
          recordset: rows,
          rowsAffected: [meta?.affectedRows ?? 0],
        };
      },
      async batch(sqlBatch) {
        const [rows, meta] = await pool.query(sqlBatch);
        return { recordset: rows, rowsAffected: [meta?.affectedRows ?? 0] };
      },
      clear() { for (const k of Object.keys(params)) delete params[k]; return this; }
    };
  };

  return pool;
}

async function getPool() { return initPool(); }

// 🔧 Stub de tipos “sql” para que no rompa require('...').sql.*
const sql = {
  Int: 'Int',
  TinyInt: 'TinyInt',
  Bit: 'Bit',
  NVarChar: (..._args) => 'NVarChar',
  VarChar:  (..._args) => 'VarChar',
  Date: 'Date',
  DateTime2: 'DateTime2',
  Decimal:  (..._args) => 'Decimal',
  MAX: 'MAX',
};

module.exports = { getPool, sql };
