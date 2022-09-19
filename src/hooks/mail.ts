import { createTransport } from 'nodemailer';
import { DiningAvailability } from '../disney-api/model/response';
import { GluegunPrint } from 'gluegun';

const to = process.env.EMAIL_TO;
const user = process.env.EMAIL_USERNAME;
const pass = process.env.EMAIL_PASSWORD;

const transporter = createTransport({
  auth: { user, pass },
  service: 'gmail',
});

function sendMail(mailOptions) {
  return new Promise((resolve, reject) => {
    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        reject(error);
      } else {
        resolve(info);
      }
    });
  });
}

export default async function mail({
  diningAvailability,
  print,
  partySize,
  date,
}: {
  diningAvailability: DiningAvailability;
  print: GluegunPrint;
  partySize: number;
  date: string;
}) {
  if (!user || !pass) {
    print.warning('No email credentials provided');
    return;
  }

  const mailOptions = {
    subject: `Found openings for ${diningAvailability.card.name} on ${date}`,
    to,
    from: user,
    text: JSON.stringify(diningAvailability),
  };

  try {
    await sendMail(mailOptions);
    console.log('✔ email sent');
  } catch (err) {
    console.error(err, "✖ couldn't send email");
  }
}
