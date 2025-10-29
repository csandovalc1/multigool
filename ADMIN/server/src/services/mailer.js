const nodemailer = require('nodemailer');

const {
  GMAIL_USER,
  GMAIL_PASS,
  MAIL_FROM_NAME = 'Reservas'
} = process.env;

if (!GMAIL_USER || !GMAIL_PASS) {
  console.warn('[mailer] GMAIL_USER/GMAIL_PASS faltan en .env — el correo no podrá enviarse');
}

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: { user: GMAIL_USER, pass: GMAIL_PASS }
});

async function sendMail({ to, subject, text, html, replyTo }) {
  if (!GMAIL_USER || !GMAIL_PASS) {
    console.warn('[mailer] omitido: faltan credenciales');
    return;
  }
  const from = `"${MAIL_FROM_NAME}" <${GMAIL_USER}>`;
  await transporter.sendMail({ from, to, subject, text, html, replyTo: replyTo || GMAIL_USER });
}

module.exports = { sendMail };
