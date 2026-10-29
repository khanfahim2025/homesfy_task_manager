import type { Bindings } from '../types';

interface Email {
  to: string | string[];
  subject: string;
  html: string;
}

/** Sends through Resend. Without RESEND_API_KEY the email is logged and skipped. */
export async function sendEmail(env: Bindings, email: Email): Promise<void> {
  const apiKey = env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    console.log(`[email] RESEND_API_KEY not set, skipping "${email.subject}"`);
    return;
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: env.EMAIL_FROM ?? 'Task Manager <onboarding@resend.dev>',
      ...email,
    }),
  });
  if (!res.ok) console.error(`[email] Resend ${res.status}: ${await res.text()}`);
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);
}

function layout(heading: string, body: string, cta: { label: string; url: string }): string {
  return `<div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#111">
<h2 style="margin:0 0 12px">${heading}</h2>
${body}
<p style="margin:24px 0"><a href="${cta.url}" style="background:#4f46e5;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none">${cta.label}</a></p>
<p style="color:#666;font-size:12px">Or open: ${cta.url}</p>
</div>`;
}

export function inviteEmail(name: string, url: string): Email['html'] {
  return layout(
    `Hi ${escapeHtml(name)}, you're invited`,
    '<p>You have been added to the Homesfy Task Manager. Set your password to get started.</p>',
    { label: 'Set password', url }
  );
}

export function taskAssignedEmail(task: { title: string; dueDate: Date | null }, by: string, url: string) {
  const due = task.dueDate
    ? `<p>Due: ${task.dueDate.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</p>`
    : '';
  return layout(
    'New task assigned to you',
    `<p><strong>${escapeHtml(task.title)}</strong></p><p>Assigned by ${escapeHtml(by)}</p>${due}`,
    { label: 'Open task', url }
  );
}

export function mentionEmail(taskTitle: string, by: string, comment: string, url: string) {
  const excerpt = comment.length > 400 ? `${comment.slice(0, 400)}…` : comment;
  return layout(
    `${escapeHtml(by)} mentioned you`,
    `<p>On <strong>${escapeHtml(taskTitle)}</strong>:</p><blockquote style="margin:0;padding:8px 12px;border-left:3px solid #ddd;color:#333;white-space:pre-wrap">${escapeHtml(excerpt)}</blockquote>`,
    { label: 'Open task', url }
  );
}
