import nodemailer from 'nodemailer'

export async function sendWelcomeEmailIfEnabled(email: string) {
 if (process.env.ENABLE_EMAIL !== '1') return

 const host = process.env.SMTP_HOST
 const port = Number(process.env.SMTP_PORT || 587)
 const user = process.env.SMTP_USER
 const pass = process.env.SMTP_PASS

 if (!host || !user || !pass) {
 console.warn('SMTP not configured, skipping send')
 return
 }

 try {
 const transporter = nodemailer.createTransport({ host, port, auth: { user, pass } })
 await transporter.sendMail({
 from: user,
 to: email,
 subject: 'Thanks for joining the waitlist',
 text: 'We got you — we\'ll be in touch.'
 })
 } catch (err) {
 console.error('Email send failed', err)
 }
}
