import "server-only";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM_EMAIL =
  process.env.RESEND_FROM_EMAIL ?? "noreply@dashboard.merakilab.ai";
// Wrap with the brand display name unless the env value already
// includes one (e.g. "Brand <addr@domain>").
const FROM = FROM_EMAIL.includes("<") ? FROM_EMAIL : `GPR <${FROM_EMAIL}>`;

export async function sendInviteEmail({
  to,
  inviterName,
  projectName,
  projectBrief,
  inviteUrl,
}: {
  to: string;
  inviterName: string;
  projectName: string;
  projectBrief: string;
  inviteUrl: string;
}) {
  const { data, error } = await resend.emails.send({
    from: FROM,
    to: [to],
    subject: `${inviterName} invited you to ${projectName} on GPR`,
    html: renderInviteHtml({ inviterName, projectName, projectBrief, inviteUrl }),
  });

  if (error) {
    console.error("[email] Resend error:", error);
    throw new Error("Failed to send invite email");
  }
  return data;
}

export async function sendNudgeEmail({
  to,
  fromName,
  projectName,
  message,
}: {
  to: string;
  fromName: string;
  projectName: string;
  message: string;
}) {
  const { data, error } = await resend.emails.send({
    from: FROM,
    to: [to],
    subject: `GPR Nudge — ${projectName}`,
    html: renderNudgeHtml({ fromName, projectName, message }),
  });

  if (error) {
    console.error("[email] Resend nudge error:", error);
    throw new Error("Failed to send nudge email");
  }
  return data;
}

function renderNudgeHtml({
  fromName,
  projectName,
  message,
}: {
  fromName: string;
  projectName: string;
  message: string;
}) {
  return `<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#fafafa;">
  <div style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Helvetica,Arial,sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;color:#111;">
    <div style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;letter-spacing:0.3em;color:#DC2626;text-transform:uppercase;margin-bottom:24px;">
      GPR — Nudge
    </div>
    <h1 style="font-size:24px;margin:0 0 8px;line-height:1.2;">A teammate is calling you up.</h1>
    <p style="font-size:14px;line-height:1.5;margin:0 0 24px;color:#666;">
      <strong>${escapeHtml(fromName)}</strong> sent you a nudge from <strong>${escapeHtml(projectName)}</strong>.
    </p>
    <div style="background:#fff;border:1px solid #eee;border-left:3px solid #DC2626;padding:16px 20px;margin:0 0 24px;font-size:15px;line-height:1.55;white-space:pre-line;color:#222;">${escapeHtml(message)}</div>
    <p style="font-size:13px;color:#777;margin:32px 0 0;line-height:1.5;">
      The ref keeps receipts. Hop into GPR and show some life.
    </p>
  </div>
</body></html>`;
}

function renderInviteHtml({
  inviterName,
  projectName,
  projectBrief,
  inviteUrl,
}: {
  inviterName: string;
  projectName: string;
  projectBrief: string;
  inviteUrl: string;
}) {
  return `<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#fafafa;">
  <div style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Helvetica,Arial,sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;color:#111;">
    <div style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;letter-spacing:0.3em;color:#DC2626;text-transform:uppercase;margin-bottom:24px;">
      GPR — Group Project Referee
    </div>
    <h1 style="font-size:26px;margin:0 0 16px;line-height:1.2;">You&rsquo;ve been invited.</h1>
    <p style="font-size:16px;line-height:1.5;margin:0 0 8px;color:#333;">
      <strong>${escapeHtml(inviterName)}</strong> invited you to join <strong>${escapeHtml(projectName)}</strong> as a project member.
    </p>
    <div style="background:#fff;border:1px solid #eee;border-left:3px solid #DC2626;padding:16px 20px;margin:24px 0;font-size:14px;line-height:1.55;white-space:pre-line;color:#444;">${escapeHtml(projectBrief)}</div>
    <p style="margin:32px 0;">
      <a href="${inviteUrl}" style="display:inline-block;background:#DC2626;color:#fff;padding:12px 28px;text-decoration:none;font-weight:500;font-size:15px;">
        Accept invite
      </a>
    </p>
    <p style="font-size:13px;color:#777;margin:32px 0 0;line-height:1.5;">
      This link expires in 7 days. GPR keeps receipts so your team knows who&rsquo;s pulling their weight.
    </p>
  </div>
</body></html>`;
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
