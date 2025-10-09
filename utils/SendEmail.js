import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

export default async function sendEmail(to, subject, htmlContent) {
  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to,
    subject,
    html: htmlContent 
  });
  console.log("the email section ")
}




// import { Resend } from 'resend';

// const resend = new Resend(process.env.RESEND_API_KEY);

// export default async function sendEmail(to, subject, htmlContent) {
//   try {
//     const data = await resend.emails.send({
//       from: "Waves Global <no-reply@wavesglobal.com>",
//       to,
//       subject,
//       html: htmlContent,
//     });

//     console.log("✅ Email sent successfully:", data.id);
//   } catch (error) {
//     console.error("❌ Email sending failed:", error);
//   }
// }
