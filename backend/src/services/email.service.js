import nodemailer from 'nodemailer';
import { env } from '../config/env.js';
import Setting from '../models/Setting.js';

let transporter = null;
let globalBranding = { appName: 'Business Sarthi', logoUrl: '' };

async function loadBranding() {
  try {
    const s = await Setting.findOne({ scope: 'PLATFORM' }).lean();
    if (s?.branding) globalBranding = s.branding;
  } catch {}
}
loadBranding();

function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.smtp.host,
      port: env.smtp.port,
      secure: env.smtp.secure,
      auth: env.smtp.user ? { user: env.smtp.user, pass: env.smtp.pass } : undefined,
    });
  }
  return transporter;
}

function baseTemplate({ title, bodyHtml, ctaText, ctaUrl }) {
  loadBranding(); // Refresh branding occasionally
  const { appName, logoUrl } = globalBranding;
  return `
  <div style="font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;background:#f8fafc;padding:40px 20px;">
    <div style="max-width:600px;margin:auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 12px rgba(0,0,0,0.05);border:1px solid #e2e8f0;">
      <div style="background:#2563eb;padding:32px;text-align:center;">
        ${logoUrl ? `<img src="${logoUrl}" alt="${appName}" style="max-height:60px;margin-bottom:12px;" /><br/>` : ''}
        <h1 style="color:#ffffff;margin:0;font-size:24px;letter-spacing:-0.025em;">${appName}</h1>
      </div>
      <div style="padding:40px 32px;">
        <h2 style="margin-top:0;color:#1e293b;font-size:20px;font-weight:700;">${title}</h2>
        <div style="color:#475569;font-size:16px;line-height:1.6;margin-top:16px;">${bodyHtml}</div>
        ${ctaUrl ? `
          <div style="margin-top:32px;text-align:center;">
            <a href="${ctaUrl}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:600;font-size:16px;">${ctaText}</a>
          </div>` : ''}
      </div>
      <div style="padding:24px 32px;background:#f1f5f9;border-top:1px solid #e2e8f0;text-align:center;">
        <p style="margin:0;color:#94a3b8;font-size:13px;">
          © ${new Date().getFullYear()} ${globalBranding.appName}. All rights reserved.<br/>
          This is an automated security notification.
        </p>
      </div>
    </div>
  </div>`;
}

export async function sendEmail({ to, subject, title, bodyHtml, ctaText, ctaUrl }) {
  if (!env.smtp.user || !env.smtp.pass) {
    console.warn(`📧 [email skipped — SMTP not configured] ${subject} → ${to}`);
    return;
  }
  try {
    const from = env.smtp.from || env.smtp.user;
    await getTransporter().sendMail({
      from,
      to,
      subject,
      html: baseTemplate({ title: title || subject, bodyHtml, ctaText, ctaUrl }),
    });
  } catch (e) {
    console.error(`📧 email failed (${subject} → ${to}):`, e.message);
  }
}

export const emails = {
  companyCreated: (to, { companyName, ownerEmail, tempPassword }) =>
    sendEmail({
      to,
      subject: 'Welcome to Business Sarthi 🎉',
      title: `Your company workspace is ready`,
      bodyHtml: `Hi there!<br/><br/>
        An account for <b>${companyName}</b> has been created on Business Sarthi.<br/><br/>
        <b>Login Email:</b> ${ownerEmail}<br/>
        <b>Temporary Password:</b> <code style="background:#f1f5f9;padding:2px 6px;border-radius:4px;font-weight:bold;">${tempPassword}</code><br/><br/>
        For security reasons, you will be required to change this password upon your first login.`,
      ctaText: 'Login to Dashboard',
      ctaUrl: `${env.clientUrl}/login`,
    }),

  staffCreated: (to, { name, companyName, tempPassword }) =>
    sendEmail({
      to,
      subject: 'Welcome to Business Sarthi',
      title: `Welcome aboard, ${name}!`,
      bodyHtml: `Your account for <b>${companyName}</b> has been successfully created.<br/><br/>
        <b>Username/Email:</b> ${to}<br/>
        <b>Temporary Password:</b> <code style="background:#f1f5f9;padding:2px 6px;border-radius:4px;font-weight:bold;">${tempPassword}</code><br/><br/>
        Please login using the link below and update your password immediately.`,
      ctaText: 'Open Staff Panel',
      ctaUrl: `${env.clientUrl}/login`,
    }),

  passwordResetOtp: (to, { name, otp }) =>
    sendEmail({
      to,
      subject: 'Verify Your Identity – OTP Code',
      title: `Identity Verification`,
      bodyHtml: `Hi ${name},<br/><br/>
        Use the following one-time password (OTP) to reset your account password:<br/><br/>
        <div style="text-align:center;background:#f8fafc;padding:20px;border-radius:12px;border:1px dashed #cbd5e1;">
          <span style="font-size:32px;font-weight:800;letter-spacing:8px;color:#2563eb;">${otp}</span>
        </div><br/>
        This code is valid for <b>10 minutes</b>. If you did not request a password reset, please secure your account immediately.`,
    }),

  passwordResetSuccess: (to, { name }) =>
    sendEmail({
      to,
      subject: 'Your Password Has Been Updated',
      title: 'Security Alert: Password Changed',
      bodyHtml: `Hi ${name},<br/><br/>
        This is to confirm that the password for your Business Sarthi account was successfully updated on <b>${new Date().toLocaleString()}</b>.<br/><br/>
        If you did not perform this action, please contact support immediately to lock your account.`,
    }),

  staffRoleChanged: (to, { name, oldPosition, newPosition, effectiveDate, remarks }) =>
    sendEmail({
      to,
      subject: 'Position Update Notification',
      title: 'Official Designation Update',
      bodyHtml: `Hi ${name},<br/><br/>
        This email is to formally notify you of a change in your official designation/position.<br/><br/>
        <table style="width:100%;border-collapse:collapse;margin:20px 0;font-size:14px;">
          <tr><td style="padding:8px 0;color:#64748b;">Previous Position:</td><td style="padding:8px 0;font-weight:600;">${oldPosition}</td></tr>
          <tr><td style="padding:8px 0;color:#64748b;">New Position:</td><td style="padding:8px 0;font-weight:600;color:#2563eb;">${newPosition}</td></tr>
          <tr><td style="padding:8px 0;color:#64748b;">Effective Date:</td><td style="padding:8px 0;font-weight:600;">${effectiveDate}</td></tr>
        </table>
        ${remarks ? `<p><b>Remarks:</b> ${remarks}</p>` : ''}<br/>
        Thank you for your valuable contribution to the team.`,
    }),
};
