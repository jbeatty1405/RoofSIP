import nodemailer from 'nodemailer'

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
})

export async function sendWelcomeEmail({
  to,
  pmName,
}: {
  to: string
  pmName?: string
}) {
  const firstName = pmName?.split(' ')[0] ?? 'there'
  const dashboardUrl = 'https://roofsip.vercel.app/homeowners'

  await transporter.sendMail({
    from: `RoofSIP <${process.env.GMAIL_USER}>`,
    to,
    subject: `You're in — here's how RoofSIP works`,
    html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#09090b;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <div style="max-width:560px;margin:0 auto;padding:40px 24px">

    <!-- Header -->
    <div style="margin-bottom:32px">
      <span style="font-size:22px;font-weight:900;color:#f4f4f5;letter-spacing:-0.5px">Roof<span style="color:#0ea5e9">SIP</span></span>
    </div>

    <!-- Hero -->
    <div style="margin-bottom:36px">
      <h1 style="margin:0 0 12px;font-size:28px;font-weight:800;color:#f4f4f5;line-height:1.2">
        Welcome, ${firstName}.<br>Storm season just got easier.
      </h1>
      <p style="margin:0;font-size:16px;color:#a1a1aa;line-height:1.6">
        Your 60-day free trial is active. Here's everything you need to know to get your first inspection booked.
      </p>
    </div>

    <!-- How it works -->
    <div style="background:#18181b;border:1px solid #27272a;border-radius:14px;padding:24px;margin-bottom:24px">
      <p style="margin:0 0 20px;font-size:11px;font-weight:700;color:#0ea5e9;text-transform:uppercase;letter-spacing:1.5px">How it works</p>

      <div style="display:flex;gap:12px;margin-bottom:18px;align-items:flex-start">
        <div style="width:28px;height:28px;background:#0ea5e9;border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:13px;font-weight:700;color:white;text-align:center;line-height:28px">1</div>
        <div>
          <p style="margin:0 0 3px;font-size:14px;font-weight:600;color:#f4f4f5">Add your homeowners</p>
          <p style="margin:0;font-size:13px;color:#71717a;line-height:1.5">One name and phone number is all you need. Takes 10 seconds per person.</p>
        </div>
      </div>

      <div style="display:flex;gap:12px;margin-bottom:18px;align-items:flex-start">
        <div style="width:28px;height:28px;background:#0ea5e9;border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:13px;font-weight:700;color:white;text-align:center;line-height:28px">2</div>
        <div>
          <p style="margin:0 0 3px;font-size:14px;font-weight:600;color:#f4f4f5">Storm hits — RoofSIP texts them</p>
          <p style="margin:0;font-size:13px;color:#71717a;line-height:1.5">NOAA detects hail or wind in their area. A personal AI-written text goes out within the hour — sounds like you wrote it.</p>
        </div>
      </div>

      <div style="display:flex;gap:12px;align-items:flex-start">
        <div style="width:28px;height:28px;background:#0ea5e9;border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:13px;font-weight:700;color:white;text-align:center;line-height:28px">3</div>
        <div>
          <p style="margin:0 0 3px;font-size:14px;font-weight:600;color:#f4f4f5">They say yes — you get the job</p>
          <p style="margin:0;font-size:13px;color:#71717a;line-height:1.5">Homeowner replies YES → you get an email with the details and a one-click confirm. Calendar fills overnight.</p>
        </div>
      </div>
    </div>

    <!-- 3 types of homeowners -->
    <div style="background:#18181b;border:1px solid #27272a;border-radius:14px;padding:24px;margin-bottom:24px">
      <p style="margin:0 0 6px;font-size:11px;font-weight:700;color:#0ea5e9;text-transform:uppercase;letter-spacing:1.5px">Who to add first</p>
      <p style="margin:0 0 20px;font-size:13px;color:#71717a">You've got 3 buckets of people sitting in your phone right now.</p>

      <div style="border-left:2px solid #0ea5e9;padding-left:16px;margin-bottom:18px">
        <p style="margin:0 0 3px;font-size:14px;font-weight:700;color:#f4f4f5">🚪 New door knocks</p>
        <p style="margin:0;font-size:13px;color:#71717a;line-height:1.5">
          Anyone you're meeting this week canvassing. Add them on the spot — just a name and number. Next time a storm hits their neighborhood, RoofSIP reaches out automatically.
        </p>
      </div>

      <div style="border-left:2px solid #38bdf8;padding-left:16px;margin-bottom:18px">
        <p style="margin:0 0 3px;font-size:14px;font-weight:700;color:#f4f4f5">📋 The notepad list</p>
        <p style="margin:0;font-size:13px;color:#71717a;line-height:1.5">
          All those names you've been collecting in your Notes app, on paper, or in your head. Import them now — they're dead leads until a storm makes them hot again.
        </p>
      </div>

      <div style="border-left:2px solid #7dd3fc;padding-left:16px">
        <p style="margin:0 0 3px;font-size:14px;font-weight:700;color:#f4f4f5">🏠 Past job sites</p>
        <p style="margin:0;font-size:13px;color:#71717a;line-height:1.5">
          Homes you've already roofed are your best leads. They know your work, they trust you, and their neighbors watch. When storm damage hits, they call you first.
        </p>
      </div>
    </div>

    <!-- CTA -->
    <div style="text-align:center;margin-bottom:32px">
      <a href="${dashboardUrl}" style="display:inline-block;background:#0ea5e9;color:white;text-decoration:none;padding:14px 36px;border-radius:10px;font-size:15px;font-weight:700;letter-spacing:-0.2px">
        Add your first homeowner →
      </a>
      <p style="margin:12px 0 0;font-size:12px;color:#52525b">Takes about 30 seconds</p>
    </div>

    <!-- Quick tips -->
    <div style="background:#18181b;border:1px solid #27272a;border-radius:14px;padding:20px;margin-bottom:32px">
      <p style="margin:0 0 14px;font-size:11px;font-weight:700;color:#52525b;text-transform:uppercase;letter-spacing:1.5px">Quick setup tips</p>
      <div style="font-size:13px;color:#71717a;line-height:1.8">
        <div>📍 <strong style="color:#a1a1aa">Create a Market</strong> — group homeowners by neighborhood or zip code so texts go out at the right time in each area</div>
        <div>⏰ <strong style="color:#a1a1aa">Set working hours</strong> — texts only go out when you want them to</div>
        <div>✍️ <strong style="color:#a1a1aa">Pick a message style</strong> — professional, casual, or neighborhood-specific tone</div>
      </div>
    </div>

    <!-- Footer -->
    <div style="border-top:1px solid #27272a;padding-top:20px">
      <p style="margin:0 0 4px;font-size:12px;color:#52525b">
        Questions? Reply to this email — I read every one.
      </p>
      <p style="margin:0;font-size:12px;color:#3f3f46">
        RoofSIP · <a href="https://roofsip.vercel.app" style="color:#3f3f46">roofsip.vercel.app</a>
      </p>
    </div>

  </div>
</body>
</html>
    `,
  })
}

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

export async function sendPmCallEmail({
  to,
  pmName,
  homeownerName,
  homeownerPhone,
  homeownerAddress,
  availability,
}: {
  to: string
  pmName: string
  homeownerName: string
  homeownerPhone: string
  homeownerAddress: string
  availability: string
}) {
  await transporter.sendMail({
    from: `Hailey via RoofSIP <${process.env.GMAIL_USER}>`,
    to,
    subject: `Call needed — ${homeownerName}`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
        <h2 style="margin:0 0 4px;font-size:18px;color:#111">Homeowner needs a quick call</h2>
        <p style="margin:0 0 24px;color:#666;font-size:14px">They're interested but gave a general window instead of a specific time.</p>

        <div style="background:#f4f4f5;border-radius:10px;padding:16px;margin-bottom:24px">
          <p style="margin:0 0 6px;font-size:14px"><strong>${homeownerName}</strong></p>
          <p style="margin:0 0 4px;font-size:13px;color:#555">${homeownerAddress}</p>
          <p style="margin:0;font-size:13px;color:#555">${homeownerPhone}</p>
        </div>

        <p style="margin:0 0 16px;font-size:14px;color:#333">They said they're available: <strong>${availability}</strong></p>
        <p style="margin:0;font-size:13px;color:#555">Give them a call to lock in the exact time. I've let them know you'll be reaching out.</p>
      </div>
    `,
  })
}

export async function sendPmTimeCheckEmail({
  to,
  pmName,
  homeownerName,
  homeownerPhone,
  homeownerAddress,
  proposedTime,
}: {
  to: string
  pmName: string
  homeownerName: string
  homeownerPhone: string
  homeownerAddress: string
  proposedTime: string
}) {
  await transporter.sendMail({
    from: `Hailey via RoofSIP <${process.env.GMAIL_USER}>`,
    to,
    subject: `${homeownerName} requested ${proposedTime}`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
        <h2 style="margin:0 0 4px;font-size:18px;color:#111">Homeowner requested a time</h2>
        <p style="margin:0 0 24px;color:#666;font-size:14px">They couldn't do the original slot — here's what they suggested.</p>

        <div style="background:#f4f4f5;border-radius:10px;padding:16px;margin-bottom:24px">
          <p style="margin:0 0 6px;font-size:14px"><strong>${homeownerName}</strong></p>
          <p style="margin:0 0 4px;font-size:13px;color:#555">${homeownerAddress}</p>
          <p style="margin:0;font-size:13px;color:#555">${homeownerPhone}</p>
        </div>

        <p style="margin:0 0 16px;font-size:14px;color:#333">Their requested time: <strong>${proposedTime}</strong></p>
        <p style="margin:0;font-size:13px;color:#555">Reply to this email or call them directly to confirm. I've let them know you'll be in touch.</p>
      </div>
    `,
  })
}
