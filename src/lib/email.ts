import "server-only";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

// In demo mode (RESEND_DOMAIN unset) Resend rejects external recipients
// because no domain is verified. We hard-pin the sender to its test
// inbox and route every outgoing message to DEMO_EMAIL so the demo
// flow still works end-to-end.
const RESEND_DOMAIN = process.env.RESEND_DOMAIN?.trim();
const DEMO_EMAIL = process.env.DEMO_EMAIL?.trim();
const IS_DEMO_MODE = !RESEND_DOMAIN;

const FROM =
  IS_DEMO_MODE || !process.env.RESEND_FROM_EMAIL
    ? "GPR <onboarding@resend.dev>"
    : process.env.RESEND_FROM_EMAIL;

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
  if (IS_DEMO_MODE && !DEMO_EMAIL) {
    throw new Error(
      "Email send blocked: set DEMO_EMAIL or verify a domain via RESEND_DOMAIN.",
    );
  }

  const actualTo = IS_DEMO_MODE ? DEMO_EMAIL! : to;
  const subject = IS_DEMO_MODE
    ? `[demo · for ${to}] ${inviterName} invited you to ${projectName} on GPR`
    : `${inviterName} invited you to ${projectName} on GPR`;

  const { data, error } = await resend.emails.send({
    from: FROM,
    to: [actualTo],
    subject,
    html: renderInviteHtml({
      inviterName,
      projectName,
      projectBrief,
      inviteUrl,
      demoOriginalTo: IS_DEMO_MODE ? to : null,
    }),
  });

  if (error) {
    console.error("[email] Resend error:", error);
    throw new Error("Failed to send invite email");
  }
  return data;
}

function renderInviteHtml({
  inviterName,
  projectName,
  projectBrief,
  inviteUrl,
  demoOriginalTo,
}: {
  inviterName: string;
  projectName: string;
  projectBrief: string;
  inviteUrl: string;
  demoOriginalTo: string | null;
}) {
  const demoBanner = demoOriginalTo
    ? `<div style="background:#fef3c7;border:1px solid #f59e0b;color:#92400e;padding:10px 14px;font-family:ui-monospace,Menlo,monospace;font-size:12px;margin-bottom:24px;">
         <strong>Demo redirect.</strong> The real recipient of this invite is <strong>${escapeHtml(demoOriginalTo)}</strong>; it landed in this inbox because RESEND_DOMAIN is unset.
       </div>`
    : "";
  return `<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#fafafa;">
  <div style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Helvetica,Arial,sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;color:#111;">
    ${demoBanner}
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
