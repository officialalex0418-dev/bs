import nodemailer from 'nodemailer';
import { env } from '../config/env.js';
import Setting from '../models/Setting.js';

let transporter = null;
let globalBranding = {
  appName: 'Business Sarthi',
  logoUrl: '',
  tagline: 'Driving Your Business Forward'
};

async function loadBranding() {
  try {
    const s = await Setting.findOne({ scope: 'PLATFORM' }).lean();
    if (s?.branding) globalBranding = s.branding;
  } catch {}
}
loadBranding();

function baseTemplate({ title, bodyHtml, ctaText, ctaUrl }) {
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
  const html = baseTemplate({ title: title || subject, bodyHtml, ctaText, ctaUrl });

  // --- METHOD 1: SMTP (Prioritized for SMTP Protocol deployment) ---
  if (env.smtp.user && env.smtp.pass) {
    try {
      if (!transporter) {
        const isGmail = env.smtp.host?.includes('gmail.com') || env.smtp.user?.includes('gmail.com');

        transporter = nodemailer.createTransport({
          host: env.smtp.host,
          port: env.smtp.port,
          secure: env.smtp.secure, // true for 465, false for 587
          auth: {
            user: env.smtp.user,
            pass: env.smtp.pass,
          },
          service: isGmail ? 'gmail' : undefined,
          tls: {
            rejectUnauthorized: false // Helps with various cloud hosting cert issues
          }
        });
      }

      const info = await transporter.sendMail({
        from: env.smtp.from,
        to,
        subject,
        html,
      });

      console.log(`📧 Email sent via SMTP: ${info.messageId}`);
      return info;
    } catch (e) {
      console.error(`📧 SMTP failed:`, e.message);
      // Continue to fallback if SMTP fails
    }
  }

  // --- METHOD 2: RESEND API FALLBACK ---
  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM || 'onboarding@resend.dev';

  if (RESEND_API_KEY) {
    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${RESEND_API_KEY}`
        },
        body: JSON.stringify({
          from: from,
          to: [to],
          subject: subject,
          html,
        })
      });
      const result = await response.json();
      if (!response.ok) {
        console.error(`❌ Resend Error: ${result.message}`);
        return null;
      }
      console.log(`📧 Email sent via Resend API`);
      return result;
    } catch (e) {
      console.error(`📧 Resend fallback failed:`, e.message);
    }
  }

  console.warn(`📧 [email skipped] No SMTP credentials or API Key found.`);
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

  passwordReset: (to, { name, resetUrl }) =>
    sendEmail({
      to,
      subject: 'Reset Your Password',
      title: `Password Reset Request`,
      bodyHtml: `Hi ${name},<br/><br/>
        We received a request to reset your Business Sarthi password. Click the button below to choose a new one.<br/><br/>
        This link will expire in <b>30 minutes</b>.`,
      ctaText: 'Reset Password',
      ctaUrl: resetUrl,
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

  packageAssigned: (to, { companyName, packageName }) =>
    sendEmail({
      to,
      subject: 'Subscription Plan Updated',
      title: 'Package Successfully Assigned',
      bodyHtml: `Hello,<br/><br/>
        We are pleased to inform you that your company <b>${companyName}</b> has been moved to the <b>${packageName}</b> plan.<br/><br/>
        Your new features and limits are now active.`,
      ctaText: 'View Package Details',
      ctaUrl: `${env.clientUrl}/login`,
    }),

  saleSubmitted: (to, { staffName, productName, amount, quantity }) =>
    sendEmail({
      to,
      subject: 'New Sale Recorded',
      title: 'Sale Submission Notification',
      bodyHtml: `A new sale has been submitted by <b>${staffName}</b>.<br/><br/>
        <b>Product:</b> ${productName}<br/>
        <b>Quantity:</b> ${quantity}<br/>
        <b>Total Amount:</b> NPR ${amount.toLocaleString()}`,
      ctaText: 'View Sales Report',
      ctaUrl: `${env.clientUrl}/login`,
    }),

  leaveDecision: (to, { name, status, type, fromDate, toDate, note }) =>
    sendEmail({
      to,
      subject: `Leave Request ${status}`,
      title: `Your Leave Request was ${status}`,
      bodyHtml: `Hi ${name},<br/><br/>
        Your request for <b>${type}</b> leave from <b>${fromDate}</b> to <b>${toDate}</b> has been <b>${status.toLowerCase()}</b>.<br/><br/>
        ${note ? `<b>Reviewer's Note:</b> ${note}` : ''}`,
      ctaText: 'View Leave Status',
      ctaUrl: `${env.clientUrl}/login`,
    }),

  payrollGenerated: (to, { name, month, netSalary, currency }) =>
    sendEmail({
      to,
      subject: `Salary Slip - ${month}`,
      title: 'Monthly Payroll Ready',
      bodyHtml: `Hi ${name},<br/><br/>
        Your salary slip for <b>${month}</b> has been generated.<br/><br/>
        <b>Net Payable:</b> ${currency} ${netSalary.toLocaleString()}<br/><br/>
        You can download the full PDF slip from the employee dashboard.`,
      ctaText: 'View Payroll',
      ctaUrl: `${env.clientUrl}/login`,
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

  deviceResetRequested: (to, { ownerName, staffName, staffEmail }) =>
    sendEmail({
      to,
      subject: 'Device Reset Request - Security Action Required',
      title: 'Action Required: Device Reset',
      bodyHtml: `Hi ${ownerName},<br/><br/>
        An employee, <b>${staffName}</b> (${staffEmail}), has requested a device reset for their account.<br/><br/>
        For security reasons, they cannot login from a new device until you authorize this reset from the employee management panel.<br/><br/>
        If you authorize this, they will be able to register their next login device as their new primary device.`,
      ctaText: 'Open Employee Management',
      ctaUrl: `${env.clientUrl}/login`,
    }),
};
