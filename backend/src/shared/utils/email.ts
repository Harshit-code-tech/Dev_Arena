import nodemailer from "nodemailer";

const smtpUser = process.env.EMAIL_HOST_USER || process.env.BREVO_SMTP_USER;
const smtpPassword = process.env.EMAIL_HOST_PASSWORD || process.env.BREVO_SMTP_PASSWORD;
const senderAddress = process.env.EMAIL_FROM || smtpUser;

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || "smtp-relay.brevo.com",
  port: Number(process.env.EMAIL_PORT) || 587,
  secure: false,
  auth: {
    user: smtpUser,
    pass: smtpPassword,
  },
});

export type DevArenaEmailOptions = {
  eyebrow: string;
  title: string;
  paragraphs?: string[];
  code?: string;
  codeLabel?: string;
  action?: { label: string; url: string };
  warning?: string;
  footer?: string;
};

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  })[character] || character);
}

function buildDevArenaEmail(options: DevArenaEmailOptions) {
  const paragraphs = options.paragraphs || [];
  const textParts = [
    options.eyebrow,
    options.title,
    ...paragraphs,
    options.code ? `${options.codeLabel || "Verification code"}: ${options.code}` : "",
    options.action ? `${options.action.label}: ${options.action.url}` : "",
    options.warning || "",
    options.footer || "",
  ].filter(Boolean);

  const paragraphHtml = paragraphs
    .map((paragraph) => `<p style="margin:0 0 14px;color:#c8c8cb;font-size:15px;line-height:1.7">${escapeHtml(paragraph)}</p>`)
    .join("");

  const codeHtml = options.code
    ? `<div style="margin:28px 0 22px;border-top:1px solid #3a3a3f;border-bottom:1px solid #3a3a3f;padding:22px 0;text-align:center">
        <p style="margin:0 0 10px;color:#8f9095;font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase">${escapeHtml(options.codeLabel || "Verification code")}</p>
        <div style="color:#ffffff;font-family:Arial Narrow,Arial,sans-serif;font-size:38px;font-weight:700;letter-spacing:10px;line-height:1">${escapeHtml(options.code)}</div>
      </div>`
    : "";

  const actionHtml = options.action
    ? `<p style="margin:28px 0 8px"><a href="${escapeHtml(options.action.url)}" style="display:inline-block;color:#ffffff;font-size:12px;font-weight:700;letter-spacing:1.15px;text-decoration:none;text-transform:uppercase;border-bottom:1px solid #ffffff;padding:0 0 5px">${escapeHtml(options.action.label)}</a></p>`
    : "";

  const warningHtml = options.warning
    ? `<p style="margin:22px 0 0;color:#a8a8ac;font-size:12px;line-height:1.6">${escapeHtml(options.warning)}</p>`
    : "";

  const footer = options.footer || "This message was sent by DevArena. Please do not reply to this automated email.";
  const html = `<!doctype html>
<html lang="en">
  <body style="margin:0;padding:0;background:#000000;color:#ffffff;font-family:Arial,Verdana,sans-serif">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#000000;padding:28px 14px">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;border:1px solid #3a3a3f;background:#0a0a0a">
            <tr>
              <td style="padding:32px 40px">
                <p style="margin:0 0 16px;color:#f0f0fa;font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase">${escapeHtml(options.eyebrow)}</p>
                <h1 style="margin:0 0 20px;color:#ffffff;font-family:Arial Narrow,Arial,sans-serif;font-size:34px;font-weight:700;line-height:1.05;letter-spacing:.8px;text-transform:uppercase">${escapeHtml(options.title)}</h1>
                ${paragraphHtml}
                ${codeHtml}
                ${actionHtml}
                ${warningHtml}
              </td>
            </tr>
            <tr>
              <td style="border-top:1px solid #242529;padding:18px 32px;color:#77787d;font-size:11px;line-height:1.55">
                ${escapeHtml(footer)}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  return { text: textParts.join("\n\n"), html };
}

export const sendEmail = async (to: string, subject: string, text: string, html?: string) => {
  try {
    const info = await transporter.sendMail({
      from: `DevArena <${senderAddress}>`,
      to,
      subject,
      text,
      html,
    });
    console.log("Email sent: %s", info.messageId);
    return true;
  } catch (error) {
    console.error("Error sending email:", error);
    return false;
  }
};

export async function sendDevArenaEmail(
  to: string,
  subject: string,
  options: DevArenaEmailOptions,
) {
  const message = buildDevArenaEmail(options);
  return sendEmail(to, subject, message.text, message.html);
}

export type AuthOtpEmailPurpose = "signup" | "login" | "password-reset" | "identity-change";

export function sendAuthOtpEmail(to: string, otp: string, purpose: AuthOtpEmailPurpose) {
  const content: Record<AuthOtpEmailPurpose, { subject: string; eyebrow: string; title: string; paragraph: string }> = {
    signup: {
      subject: "Verify your DevArena account",
      eyebrow: "DevArena account verification",
      title: "Confirm your email",
      paragraph: "Use this one-time code to verify your email and finish creating your DevArena account.",
    },
    login: {
      subject: "Your DevArena login code",
      eyebrow: "DevArena secure access",
      title: "Complete your login",
      paragraph: "Your password was accepted. Use this one-time code to securely finish signing in to DevArena.",
    },
    "password-reset": {
      subject: "Reset your DevArena password",
      eyebrow: "DevArena account recovery",
      title: "Reset your password",
      paragraph: "Use this one-time code to verify your password reset request.",
    },
    "identity-change": {
      subject: "Verify your DevArena account change",
      eyebrow: "DevArena identity verification",
      title: "Confirm the account change",
      paragraph: "Use this one-time code to confirm the requested change to your DevArena identity details.",
    },
  };

  const selected = content[purpose];
  return sendDevArenaEmail(to, selected.subject, {
    eyebrow: selected.eyebrow,
    title: selected.title,
    paragraphs: [selected.paragraph],
    code: otp,
    codeLabel: "One-time code",
    warning: "This code expires in 10 minutes and can be used only once. If you did not request it, you can safely ignore this message.",
  });
}
