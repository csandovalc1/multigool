const { sql, getPool } = require('../config/db');


async function create({ title, summary, content, cover_url, estado }) {
const pool = await getPool();
const slug = require('../utils/slugify')(title);
const res = await pool.request()
.input('title', sql.NVarChar(160), title)
.input('slug', sql.NVarChar(160), slug)
.input('summary', sql.NVarChar(400), summary || null)
.input('content', sql.NVarChar(sql.MAX), content)
.input('cover_url', sql.NVarChar(400), cover_url || null)
.input('estado', sql.NVarChar(12), estado || 'borrador')
.query(`INSERT INTO news_posts (title, slug, summary, content, cover_url, estado)
VALUES (@title, @slug, @summary, @content, @cover_url, @estado);
SELECT SCOPE_IDENTITY() AS id;`);
return res.recordset[0].id;
}


async function list() {
const pool = await getPool();
const r = await pool.request().query('SELECT * FROM news_posts ORDER BY COALESCE(published_at, created_at) DESC');
return r.recordset;
}


async function update(id, data) {
const pool = await getPool();
await pool.request()
.input('id', sql.Int, id)
.input('title', sql.NVarChar(160), data.title)
.input('summary', sql.NVarChar(400), data.summary || null)
.input('content', sql.NVarChar(sql.MAX), data.content)
.input('cover_url', sql.NVarChar(400), data.cover_url || null)
.input('estado', sql.NVarChar(12), data.estado || 'borrador')
.query(`UPDATE news_posts SET title=@title, summary=@summary, content=@content, cover_url=@cover_url, estado=@estado, updated_at=SYSUTCDATETIME() WHERE id=@id`);
}


async function publish(id) {
const pool = await getPool();
await pool.request().input('id', sql.Int, id)
.query("UPDATE news_posts SET estado='publicado', published_at=SYSUTCDATETIME(), updated_at=SYSUTCDATETIME() WHERE id=@id");
}


async function unpublish(id) {
const pool = await getPool();
await pool.request().input('id', sql.Int, id)
.query("UPDATE news_posts SET estado='borrador', updated_at=SYSUTCDATETIME() WHERE id=@id");
}


async function remove(id) {
const pool = await getPool();
await pool.request().input('id', sql.Int, id).query('DELETE FROM news_posts WHERE id=@id');
}


module.exports = { create, list, update, publish, unpublish, remove };