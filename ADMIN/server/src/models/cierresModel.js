// models/cierresModel.js  ✅ MySQL
const { getPool } = require('../config/db');

// ========================
// LISTAR POR MES
// ========================
exports.listByMonth = async ({ year, month }) => {
  const pool = await getPool();
  const start = `${year}-${String(month).padStart(2, '0')}-01`;
  const endMonth = month === 12 ? 1 : month + 1;
  const endYear = month === 12 ? year + 1 : year;
  const end = `${endYear}-${String(endMonth).padStart(2, '0')}-01`;

  const [rows] = await pool.execute(
    `
      SELECT DATE_FORMAT(fecha, '%Y-%m-%d') AS fecha, motivo
      FROM calendario_cierres
      WHERE fecha >= :start AND fecha < :end
      ORDER BY fecha ASC
    `,
    { start, end }
  );
  return rows;
};

// ========================
// INSERT/UPDATE UPSERT
// ========================
exports.insert = async ({ fecha, motivo }, conn = null) => {
  // Usar transacción existente si viene (conn), sino pool
  const pool = await getPool();
  const executor = conn || pool;

  await executor.execute(
    `
      INSERT INTO calendario_cierres (fecha, motivo)
      VALUES (:f, :m)
      ON DUPLICATE KEY UPDATE motivo = VALUES(motivo)
    `,
    {
      f: fecha,                                      // YYYY-MM-DD
      m: motivo ? String(motivo).trim() : null,
    }
  );

  return { ok: true };
};

// ========================
// ELIMINAR DÍA DE CIERRE
// ========================
exports.remove = async (fecha) => {
  const pool = await getPool();
  await pool.execute(
    `DELETE FROM calendario_cierres WHERE fecha = :f`,
    { f: fecha }
  );
  return { ok: true };
};

// ========================
// BUSCAR CONFLICTOS
// ========================
exports.findConflicts = async (fecha) => {
  const pool = await getPool();

  const [reservas] = await pool.execute(
    `
      SELECT id
      FROM reservas
      WHERE fecha = :f
        AND estado IN ('pendiente','pagada')
    `,
    { f: fecha }
  );

  return { reservas };
};

// ========================
// CANCELAR RESERVAS POR CIERRE
// ========================
exports.cancelReservationsForDate = async (fecha, conn) => {
  if (!conn) throw new Error('cancelReservationsForDate requiere una transacción activa.');

  await conn.execute(
    `
      UPDATE reservas
      SET estado = 'cancelada_por_cierre'
      WHERE fecha = :f
        AND estado IN ('pendiente','pagada')
    `,
    { f: fecha }
  );

  const [rows] = await conn.execute(
    `
      SELECT id
      FROM reservas
      WHERE fecha = :f
        AND estado = 'cancelada_por_cierre'
    `,
    { f: fecha }
  );

  return rows.map(r => r.id);
};
