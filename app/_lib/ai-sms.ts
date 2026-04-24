import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function parsePmTimeReply(reply: string, proposedTime: Date): Promise<Date | null> {
  const today = new Date()
  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 50,
    messages: [{
      role: 'user',
      content: `Today is ${today.toDateString()}. A roofing contractor is rescheduling an inspection. They said: "${reply}". Return ONLY a valid ISO 8601 datetime string for the time they mean (e.g. 2025-04-30T14:00:00). If you cannot determine a clear date/time, return the word null.`,
    }],
  })

  const text = message.content[0].type === 'text' ? message.content[0].text.trim() : 'null'
  if (text === 'null') return null
  const parsed = new Date(text)
  return isNaN(parsed.getTime()) ? null : parsed
}

export async function generateStormSms(opts: {
  firstName: string
  pmName: string
  companyName: string
  stormType: string
  zipCode: string
  messageStyle: string
}): Promise<string> {
  const { firstName, pmName, companyName, stormType, zipCode, messageStyle } = opts

  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 200,
    messages: [
      {
        role: 'user',
        content: `You are writing a single SMS text message from a roofing contractor to a homeowner after a storm.

Contractor style guide: ${messageStyle}

Details:
- Homeowner first name: ${firstName}
- Contractor name: ${pmName}
- Company: ${companyName}
- Storm type: ${stormType}
- ZIP code: ${zipCode}

Write ONE SMS message (under 160 characters) that:
- Sounds natural and conversational, matching the style guide
- Mentions the storm and offers a free roof inspection
- Asks the homeowner to reply YES to book
- Does NOT include any intro like "Here is the message:" — just the message itself
- Does NOT use quotation marks around the message`,
      },
    ],
  })

  const text = message.content[0].type === 'text' ? message.content[0].text.trim() : ''
  return text || `Hi ${firstName}, ${pmName} here from ${companyName}. We're seeing ${stormType.toLowerCase()} near your home. Reply YES for a free roof inspection.`
}
