function pad2(n){ return String(n).padStart(2,'0'); }
function toLocalGT(ymd){
  try {
    const [y,m,d] = String(ymd).split('-').map(Number);
    const dt = new Date(y, (m||1)-1, d||1);
    return dt.toLocaleDateString('es-GT', { day:'2-digit', month:'short', year:'numeric' });
  } catch { return ymd; }
}
function fmtMoneyQ(v){
  const num = Number(v ?? 0);
  return `Q ${num.toFixed(2)}`;
}

const BRAND_LOGO_URL = process.env.BRAND_LOGO_URL || '';
const BRAND_NAME     = process.env.BRAND_NAME || 'Nuestro Complejo';

function buildReservaEmail(reserva){
  const nombres = [reserva?.cliente?.nombres, reserva?.cliente?.apellidos].filter(Boolean).join(' ') || '—';
  const fechaNice = toLocalGT(reserva.fecha);
  const durH = Math.round(((Number(reserva.dur_minutos || 0) / 60) + Number.EPSILON) * 10)/10;
  const total = (reserva.total_q != null)
    ? fmtMoneyQ(Number(reserva.total_q))
    : fmtMoneyQ((Number(reserva.dur_minutos||0)/60) * 100);

  const subject = `Reserva confirmada ${reserva.code} — ${fechaNice} ${reserva.hi}`;

  // Texto preheader (se ve en la bandeja, no dentro del mensaje)
  const preheader = `Código ${reserva.code} · ${fechaNice} ${reserva.hi} · ${reserva.cancha}`;

  const text =
`¡Gracias por tu reserva en ${BRAND_NAME}!

Código: ${reserva.code}
Estado: ${reserva.estado}

Cancha: ${reserva.cancha} ${reserva.tipo_futbol ? `(${reserva.tipo_futbol})` : ''}
Fecha: ${fechaNice}
Horario: ${reserva.hi} – ${reserva.hf} (${durH} h)

Total a pagar: ${total}

Cliente:
- Nombre: ${nombres}
- Correo: ${reserva?.cliente?.email || '—'}
- Teléfono: ${reserva?.cliente?.telefono || '—'}

${reserva?.notas ? `Notas: ${reserva.notas}\n\n` : ''}Cualquier consulta o cambio, por favor responde a este correo.`;

  const html = `
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">
    ${preheader}
  </div>
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f5f7fb;padding:20px 0;">
    <tr>
      <td align="center" valign="top">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;background:#ffffff;border:1px solid #e6e9ef;border-radius:12px;overflow:hidden;">
          <!-- Header -->
          <tr>
            <td align="center" valign="middle" style="background:#0f172a;padding:16px 20px;">
              ${
  BRAND_LOGO_URL
  ? `<img src="${BRAND_LOGO_URL}" alt="${BRAND_NAME}" width="360"
          style="display:block;width:360px;height:auto;max-width:360px;outline:none;border:none;text-decoration:none;" />`
  : `<div style="color:#ffffff;font-weight:900;font-size:26px;letter-spacing:.6px;text-transform:uppercase;line-height:1;">
       ${BRAND_NAME}
     </div>`
}

            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:20px;">
              <h2 style="margin:0 0 8px 0;font-family:system-ui,-apple-system,Segoe UI,Roboto,Ubuntu,Helvetica,Arial,sans-serif;line-height:1.3;color:#0f172a;">
                ¡Gracias por tu reserva!
              </h2>
              <p style="margin:0 0 14px 0;font-family:system-ui,-apple-system,Segoe UI,Roboto,Ubuntu,Helvetica,Arial,sans-serif;color:#334155;">
                Hemos registrado tu reserva. Aquí tienes los detalles:
              </p>

              <!-- Card código/estado -->
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"
                     style="margin:12px 0;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;">
                <tr>
                  <td style="padding:12px 14px;font-family:system-ui,-apple-system,Segoe UI,Roboto,Ubuntu,Helvetica,Arial,sans-serif;color:#0f172a;">
                    <div style="margin-bottom:6px;">
                      <b>Código:</b>
                      <span style="font-family:ui-monospace,Menlo,Consolas,monospace;background:#fff;border:1px solid #e2e8f0;border-radius:6px;padding:2px 6px;display:inline-block;">
                        ${reserva.code}
                      </span>
                    </div>
                    <div><b>Estado:</b> ${reserva.estado}</div>
                  </td>
                </tr>
              </table>

              <!-- Detalle -->
              <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Ubuntu,Helvetica,Arial,sans-serif;color:#0f172a;line-height:1.5;">
                <div><b>Cancha:</b> ${reserva.cancha} ${reserva.tipo_futbol ? `<span style="color:#64748b;font-size:12px">(${reserva.tipo_futbol})</span>` : ''}</div>
                <div><b>Fecha:</b> ${fechaNice}</div>
                <div><b>Horario:</b> ${reserva.hi} – ${reserva.hf} (${durH} h)</div>

                <div style="margin:10px 0 12px 0;font-size:16px;">
                  <b>Total a pagar:</b> <span>${total}</span>
                </div>

                <hr style="border:none;border-top:1px solid #e2e8f0;margin:12px 0" />

                <div style="color:#475569;font-size:14px;margin-bottom:6px">Cliente</div>
                <div><b>Nombre:</b> ${nombres}</div>
                <div><b>Correo:</b> ${reserva?.cliente?.email || '—'}</div>
                <div><b>Teléfono:</b> ${reserva?.cliente?.telefono || '—'}</div>
                ${reserva?.notas ? `<div style="margin-top:8px"><span style="color:#64748b">Notas: </span>${reserva.notas}</div>` : ''}

                <p style="margin-top:16px;color:#64748b;font-size:12px">
                  Si necesitas reprogramar o cancelar, responde a este correo y con gusto te ayudamos.
                </p>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f8fafc;color:#64748b;font-size:12px;padding:12px 20px;font-family:system-ui,-apple-system,Segoe UI,Roboto,Ubuntu,Helvetica,Arial,sans-serif;text-align:center;border-top:1px solid #e6e9ef;">
              ${BRAND_NAME} • Gracias por elegirnos ⚽<br/>
              <span style="font-size:11px;color:#94a3b8;">Este correo se generó automáticamente. No compartas tu código de reserva.</span>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>`;

  return { subject, text, html };
}

module.exports = { buildReservaEmail };
