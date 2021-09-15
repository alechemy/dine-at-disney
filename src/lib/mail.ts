import { createTransport } from 'nodemailer';

const to = process.env.EMAIL_TO;
const user = process.env.EMAIL_USERNAME;
const pass = process.env.EMAIL_PASSWORD;

const transporter = createTransport({
  auth: { user, pass },
  service: 'gmail',
});

export async function mail(subject, message) {
  const mailOptions = {
    subject,
    to,
    from: user,
    text: message,
  };

  return transporter.sendMail(mailOptions, (error) => {
    if (error) {
      console.error(error, "✖ couldn't send email");
    } else {
      console.log('✔ email sent');
    }
  });
}
