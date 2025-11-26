const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

async function sendWelcomeEmail({ to, subject, body }) {
  return transporter.sendMail({
    from: process.env.FROM_EMAIL,
    to,
    subject,
    html: body,
  });
}

module.exports = { sendWelcomeEmail };
