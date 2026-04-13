import { transporter, GMAIL_USER as NODEMAILER_USER } from './nodemailer';
import { isEmailBlocked, recordEmailFailure } from './emailStatusServer';
import { ADMIN_EMAIL, EmailPayload } from './emailTemplates';
import * as templates from './emailTemplates';

/**
 * Robust Direct Email Sending (SERVER ONLY).
 * This function bypasses API fetches and speaks directly to SMTP.
 * Use this in API Routes or Server Actions to avoid base URL resolution issues.
 */
export async function sendEmailDirect(payload: EmailPayload): Promise<void> {
    const recipients = Array.isArray(payload.toEmail) ? payload.toEmail : [payload.toEmail];

    // Filter out internal mobile-auth addresses
    const realRecipients = recipients.filter(email =>
        email && typeof email === 'string' && !email.endsWith('@dbohrarishta.local')
    );

    if (realRecipients.length === 0) return;

    try {
        // Filter recipients against local blocklist
        const activeRecipients: string[] = [];
        for (const email of realRecipients) {
            const blocked = await isEmailBlocked(email);
            if (!blocked) activeRecipients.push(email);
            else console.warn(`[EmailServiceServer] Skipping blocked email: ${email}`);
        }

        if (activeRecipients.length === 0) return;

        const fromUser = NODEMAILER_USER || ADMIN_EMAIL;
        const mailOptions = {
            from: `"53DBohraRishta" <${fromUser}>`,
            to: activeRecipients.join(', '),
            cc: payload.cc ? (Array.isArray(payload.cc) ? payload.cc.join(', ') : payload.cc) : undefined,
            bcc: payload.bcc ? (Array.isArray(payload.bcc) ? payload.bcc.join(', ') : payload.bcc) : ADMIN_EMAIL, 
            subject: payload.subject,
            html: payload.htmlBody,
        };

        const info = await transporter.sendMail(mailOptions);
        console.log('[EmailServiceServer] SMTP Send OK:', info.response);
    } catch (serverError: any) {
        const msg = serverError.message || 'Unknown Server Error';
        console.error("[EmailServiceServer] SMTP Failed:", msg);
        // Record failure
        for(const email of realRecipients) {
            await recordEmailFailure(email, msg);
        }
    }
}

// ── Server-Side Notification Helpers ────────────────────────────

export async function notifyStatusUpdate(opts: {
    candidateName: string;
    candidateEmail: string;
    newStatus: string;
    adminMessage?: string;
}) {
    const statusLabels: any = {
        verified: "Verified & Approved",
        approved: "Approved",
        rejected: "Action Required / Profile Rejected",
        hold: "Profile Put On Hold",
        photo_verified: "Profile Verified (Photo Identity Approved)",
        selfie_verified: "Profile Verified (Selfie Approved)"
    };
    const statusLabel = statusLabels[opts.newStatus] || opts.newStatus;

    await sendEmailDirect({
        toEmail: opts.candidateEmail,
        bcc: ADMIN_EMAIL,
        subject: `🚨 Profile Status Update: ${statusLabel} – 53DBohraRishta`,
        htmlBody: templates.getStatusUpdateTemplate({ ...opts, statusLabel }),
    });
}

export async function notifyVideoHandshakeStatusServer(opts: {
    candidateName: string;
    candidateEmail: string;
    status: 'verified' | 'rejected';
    reason?: string;
}) {
    const isApproved = opts.status === 'verified';
    await sendEmailDirect({
        toEmail: opts.candidateEmail,
        subject: isApproved ? `🎥 Video Handshake Verified! – 53DBohraRishta` : `⚠️ Update on your Video Handshake – 53DBohraRishta`,
        htmlBody: isApproved 
            ? templates.getVideoApprovedTemplate({ candidateName: opts.candidateName })
            : templates.getVideoRejectedTemplate({ candidateName: opts.candidateName, reason: opts.reason }),
    });
}
