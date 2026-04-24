import nodemailer from 'nodemailer'

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
})

export async function sendPmConfirmationEmail({
  to,
  pmName,
  homeownerName,
  homeownerPhone,
  homeownerAddress,
  proposedTime,
  confirmUrl,
}: {
  to: string
  pmName: string
  homeownerName: string
  homeownerPhone: string
  homeownerAddress: string
  proposedTime: string
  confirmUrl: string
}) {
  await transporter.sendMail({
    from: `RoofSIP <${process.env.GMAIL_USER}>`,
    to,
    subject: `New inspection request — ${homeownerName}`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
        <h2 style="margin:0 0 4px;font-size:18px;color:#111">New inspection request</h2>
        <p style="margin:0 0 24px;color:#666;font-size:14px">A homeowner replied YES to your storm alert.</p>

        <div style="background:#f4f4f5;border-radius:10px;padding:16px;margin-bottom:24px">
          <p style="margin:0 0 6px;font-size:14px"><strong>${homeownerName}</strong></p>
          <p style="margin:0 0 4px;font-size:13px;color:#555">${homeownerAddress}</p>
          <p style="margin:0;font-size:13px;color:#555">${homeownerPhone}</p>
        </div>

        <p style="margin:0 0 16px;font-size:14px;color:#333">Proposed time: <strong>${proposedTime}</strong></p>

        <a href="${confirmUrl}" style="display:inline-block;background:#0ea5e9;color:white;text-decoration:none;padding:12px 28px;border-radius:8px;font-size:15px;font-weight:600">
          Confirm this time
        </a>

        <p style="margin:20px 0 0;font-size:12px;color:#999">
          If this time doesn't work, just reply to this email with your next available time and we'll update the homeowner automatically.
        </p>
      </div>
    `,
  })
}
