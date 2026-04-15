/**
 * Email Service
 * Sends transactional emails using SMTP (nodemailer).
 * Gracefully no-ops when SMTP_HOST is not configured.
 */
import nodemailer from 'nodemailer';
import { logger } from '../utils/logger.js';

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter | null {
  if (transporter) return transporter;

  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    logger.warn(
      'Email service not configured (SMTP_HOST, SMTP_USER, SMTP_PASS are required). Emails will not be sent.'
    );
    return null;
  }

  transporter = nodemailer.createTransport({
    host,
    port,
    secure: process.env.SMTP_SECURE === 'true',
    auth: { user, pass },
  });

  return transporter;
}

export interface SendMailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export async function sendMail(options: SendMailOptions): Promise<boolean> {
  const t = getTransporter();
  if (!t) {
    logger.warn(`Email not sent to ${options.to}: email service not configured.`);
    return false;
  }

  try {
    await t.sendMail({
      from: process.env.EMAIL_FROM || 'OrbitAI <noreply@orbitai.com>',
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text || options.html.replace(/<[^>]+>/g, ''),
    });
    logger.info(`Email sent to ${options.to}: ${options.subject}`);
    return true;
  } catch (err: any) {
    logger.error('Failed to send email', { error: err.message, to: options.to });
    return false;
  }
}

export async function sendInvitationEmail(params: {
  to: string;
  inviterName: string;
  workspaceName: string;
  invitationToken: string;
  frontendUrl: string;
  message?: string;
}): Promise<boolean> {
  const { to, inviterName, workspaceName, invitationToken, frontendUrl, message } = params;
  const acceptUrl = `${frontendUrl}/invite/accept?token=${invitationToken}`;

  const html = `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
      <h2 style="color:#4F46E5">You've been invited to join ${workspaceName}</h2>
      <p><strong>${inviterName}</strong> has invited you to collaborate on OrbitAI.</p>
      ${message ? `<p style="color:#555;font-style:italic">"${message}"</p>` : ''}
      <a href="${acceptUrl}"
         style="display:inline-block;margin:20px 0;padding:12px 24px;background:#4F46E5;color:#fff;text-decoration:none;border-radius:6px;font-weight:bold">
        Accept Invitation
      </a>
      <p style="color:#888;font-size:12px">This invitation expires in 7 days. If you did not expect this email, you can ignore it.</p>
      <p style="color:#888;font-size:12px">Or copy this link: ${acceptUrl}</p>
    </div>
  `;

  return sendMail({ to, subject: `You've been invited to join ${workspaceName} on OrbitAI`, html });
}
