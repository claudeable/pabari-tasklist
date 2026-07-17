/**
 * AI email analysis using Claude.
 * Classifies every incoming email for priority, category, action, and deadline.
 * Uses claude-haiku-4-5 for cost efficiency at scale; upgrade to sonnet for higher accuracy.
 */
import Anthropic from '@anthropic-ai/sdk'
import { query, execute } from '@/lib/database'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export interface EmailAnalysis {
  priority:           'Critical' | 'High' | 'Medium' | 'Low'
  category:           string
  requires_action:    boolean
  deadline:           string   // 'Today' | 'Tomorrow' | 'YYYY-MM-DD' | 'None'
  summary:            string
  recommended_action: string
}

const SYSTEM_PROMPT = `You are an executive assistant for Pabari Group, a multi-company conglomerate with interests in agriculture, finance, logistics, hospitality, and more.

Analyse incoming emails and classify them. Respond with ONLY valid JSON matching exactly:
{
  "priority": "Critical|High|Medium|Low",
  "category": "Finance|Legal|HR|Procurement|Logistics|Projects|IT|Executive|General",
  "requires_action": true|false,
  "deadline": "Today|Tomorrow|YYYY-MM-DD|None",
  "summary": "One concise sentence executive summary",
  "recommended_action": "Reply|Approve|Delegate|Archive|Review|Call"
}

Priority rules:
- Critical: board/directors, legal disputes, regulatory/compliance, payment defaults, emergencies, requires same-day response
- High: supplier/partner requests, financial approvals, project blockers, deadline < 3 days
- Medium: standard business correspondence, status updates, meeting requests, weekly reports
- Low: newsletters, FYIs, marketing, out-of-office replies, automated system emails`

export async function analyseEmail(
  subject: string,
  fromEmail: string,
  fromName: string,
  snippet: string
): Promise<EmailAnalysis> {
  const prompt = `From: ${fromName} <${fromEmail}>
Subject: ${subject}
Preview: ${snippet?.slice(0, 600) ?? '(no content)'}

Classify this email.`

  const msg = await client.messages.create({
    model:      'claude-haiku-4-5-20251001',
    max_tokens: 512,
    system:     SYSTEM_PROMPT,
    messages:   [{ role: 'user', content: prompt }],
  })

  const text = msg.content[0].type === 'text' ? msg.content[0].text : ''
  const json = text.match(/\{[\s\S]*\}/)?.[0] ?? '{}'

  try {
    const parsed = JSON.parse(json) as Partial<EmailAnalysis>
    return {
      priority:           ['Critical','High','Medium','Low'].includes(parsed.priority ?? '')
                            ? parsed.priority as EmailAnalysis['priority']
                            : 'Medium',
      category:           parsed.category ?? 'General',
      requires_action:    Boolean(parsed.requires_action),
      deadline:           parsed.deadline ?? 'None',
      summary:            parsed.summary ?? subject,
      recommended_action: parsed.recommended_action ?? 'Review',
    }
  } catch {
    return { priority: 'Medium', category: 'General', requires_action: false, deadline: 'None', summary: subject, recommended_action: 'Review' }
  }
}

// Persist analysis results and optionally queue a Critical notification
export async function persistAnalysis(
  emailId: number,
  analysis: EmailAnalysis,
  accountUserId: number
): Promise<void> {
  await execute(
    `INSERT INTO mail_email_analysis
       (email_id, priority, category, requires_action, deadline, summary, recommended_action)
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     ON CONFLICT (email_id) DO UPDATE SET
       priority=$2, category=$3, requires_action=$4, deadline=$5,
       summary=$6, recommended_action=$7, analysed_at=now()`,
    [emailId, analysis.priority, analysis.category, analysis.requires_action,
     analysis.deadline, analysis.summary, analysis.recommended_action]
  )

  if (analysis.priority === 'Critical') {
    const emailRows = await query<{ subject: string; from_name: string }>(
      `SELECT subject, from_name FROM mail_emails WHERE id = $1`,
      [emailId]
    )
    const email = emailRows[0]
    if (email) {
      await execute(
        `INSERT INTO mail_notification_queue (user_id, email_id, type, title, body, href)
         VALUES ($1,$2,'email_critical',$3,$4,$5)
         ON CONFLICT DO NOTHING`,
        [
          accountUserId,
          emailId,
          `🔴 ${email.subject}`,
          `${email.from_name || 'Unknown'} · Requires response today`,
          `/centre?tab=mail&email=${emailId}`,
        ]
      )
    }
  }
}

// Generate the AI morning email briefing for the given user
export async function generateEmailBriefing(
  userId: number,
  firstName: string
): Promise<string> {
  const stats = await query<{
    total: string; critical: string; high: string; unread: string; oldest_unread_hours: string
  }>(
    `SELECT
       COUNT(e.id)::text AS total,
       COUNT(CASE WHEN a.priority = 'Critical' THEN 1 END)::text AS critical,
       COUNT(CASE WHEN a.priority = 'High' THEN 1 END)::text AS high,
       COUNT(CASE WHEN e.is_read = false THEN 1 END)::text AS unread,
       COALESCE(EXTRACT(EPOCH FROM (now() - MIN(CASE WHEN e.is_read = false THEN e.received_at END)))/3600, 0)::text AS oldest_unread_hours
     FROM mail_emails e
     JOIN mail_accounts ma ON ma.id = e.account_id
     LEFT JOIN mail_email_analysis a ON a.email_id = e.id
     WHERE ma.user_id = $1
       AND e.is_archived = false AND e.is_deleted = false
       AND e.received_at > now() - interval '24 hours'`,
    [userId]
  )

  const s = stats[0] ?? { total:'0', critical:'0', high:'0', unread:'0', oldest_unread_hours:'0' }

  const criticalEmails = await query<{ subject: string; from_name: string; summary: string; deadline: string }>(
    `SELECT e.subject, e.from_name, a.summary, a.deadline
     FROM mail_emails e
     JOIN mail_accounts ma ON ma.id = e.account_id
     JOIN mail_email_analysis a ON a.email_id = e.id
     WHERE ma.user_id = $1 AND a.priority = 'Critical'
       AND e.is_read = false AND e.is_archived = false
       AND e.received_at > now() - interval '48 hours'
     ORDER BY e.received_at DESC LIMIT 5`,
    [userId]
  )

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening'

  let briefing = `Good ${greeting}, ${firstName}. Here is your email intelligence summary:\n\n`
  briefing += `**Email Activity (last 24h):** ${s.total} emails received · ${s.critical} Critical · ${s.high} High Priority · ${s.unread} unread\n\n`

  if (criticalEmails.length > 0) {
    briefing += `**Critical emails requiring your attention:**\n`
    criticalEmails.forEach((e, i) => {
      briefing += `${i + 1}. **${e.subject}** from ${e.from_name ?? 'Unknown'}`
      if (e.deadline !== 'None') briefing += ` — deadline: ${e.deadline}`
      briefing += `\n   ${e.summary}\n`
    })
    briefing += '\n'
  }

  if (parseInt(s.oldest_unread_hours) > 24) {
    briefing += `⚠️ You have emails unread for over ${Math.round(parseInt(s.oldest_unread_hours))} hours.\n`
  }

  return briefing
}
