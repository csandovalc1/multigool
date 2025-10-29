const { sql, getPool } = require('../config/db');

async function list(pitch_id) {
  const pool = await getPool();
  const req = pool.request();
  let q = `SELECT r.*, p.nombre AS pitch_nombre 
           FROM reservations r 
           JOIN pitches p ON r.pitch_id=p.id 
           WHERE 1=1`;
  if (pitch_id) { 
    q += ' AND r.pitch_id=@pid'; 
    req.input('pid', sql.Int, pitch_id); 
  }
  q += ' ORDER BY r.start_time ASC';
  const res = await req.query(q);
  return res.recordset;
}

async function create(data) {
  const pool = await getPool();
  // Verificar solape
  const overlap = await pool.request()
    .input('pid', sql.Int, data.pitch_id)
    .input('ini', sql.DateTime2, new Date(data.start_time))
    .input('fin', sql.DateTime2, new Date(data.end_time))
    .query(`SELECT COUNT(1) AS c FROM reservations
            WHERE pitch_id=@pid 
              AND NOT(@fin <= start_time OR @ini >= end_time)`);
  if (overlap.recordset[0].c > 0) throw new Error('Horario no disponible');

  await pool.request()
    .input('pid', sql.Int, data.pitch_id)
    .input('nombre', sql.NVarChar(120), data.nombre_contacto)
    .input('tel', sql.NVarChar(30), data.telefono_contacto || null)
    .input('source', sql.NVarChar(10), data.source || 'admin')
    .input('ini', sql.DateTime2, new Date(data.start_time))
    .input('fin', sql.DateTime2, new Date(data.end_time))
    .input('precio', sql.Decimal(10,2), data.precio || null)
    .input('estado', sql.NVarChar(12), data.estado || 'pendiente')
    .input('notas', sql.NVarChar(400), data.notas || null)
    .query(`INSERT INTO reservations 
              (pitch_id, nombre_contacto, telefono_contacto, source, start_time, end_time, precio, estado, notas)
            VALUES (@pid, @nombre, @tel, @source, @ini, @fin, @precio, @estado, @notas)`);
}

async function update(id, data) {
  const pool = await getPool();
  if (data.start_time && data.end_time && data.pitch_id) {
    const overlap = await pool.request()
      .input('id', sql.Int, id)
      .input('pid', sql.Int, data.pitch_id)
      .input('ini', sql.DateTime2, new Date(data.start_time))
      .input('fin', sql.DateTime2, new Date(data.end_time))
      .query(`SELECT COUNT(1) AS c FROM reservations
              WHERE pitch_id=@pid AND id<>@id 
                AND NOT(@fin <= start_time OR @ini >= end_time)`);
    if (overlap.recordset[0].c > 0) throw new Error('Horario no disponible');
  }

  const req = pool.request().input('id', sql.Int, id);
  if (data.estado) req.input('estado', sql.NVarChar(12), data.estado);
  if (data.precio != null) req.input('precio', sql.Decimal(10,2), data.precio);
  if (data.notas !== undefined) req.input('notas', sql.NVarChar(400), data.notas);
  if (data.start_time) req.input('ini', sql.DateTime2, new Date(data.start_time));
  if (data.end_time) req.input('fin', sql.DateTime2, new Date(data.end_time));
  if (data.pitch_id) req.input('pid', sql.Int, data.pitch_id);

  await req.query(`UPDATE reservations SET
                     estado = COALESCE(@estado, estado),
                     precio = COALESCE(@precio, precio),
                     notas = COALESCE(@notas, notas),
                     start_time = COALESCE(@ini, start_time),
                     end_time = COALESCE(@fin, end_time),
                     pitch_id = COALESCE(@pid, pitch_id)
                   WHERE id=@id`);
}

module.exports = { list, create, update };
