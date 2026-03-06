/**
 * Hybrid Email Notification Service.
 * 1. Tries Nodemailer (Server-side Gmail SMTP via /api/notify API)
 * 2. Fallbacks to EmailJS (Client-side Gmail SMTP) for static builds.
 */

const EMAILJS_SERVICE_ID = process.env.NEXT_PUBLIC_EMAILJS_SERVICE_ID || 'service_dbohra';
const EMAILJS_TEMPLATE_ID = process.env.NEXT_PUBLIC_EMAILJS_TEMPLATE_ID || 'template_notify';
const EMAILJS_PUBLIC_KEY = process.env.NEXT_PUBLIC_EMAILJS_PUBLIC_KEY || '';

export const ADMIN_EMAIL = 'abdulqadirkhanji52@gmail.com';

export interface EmailPayload {
    toEmail: string | string[];
    subject: string;
    htmlBody: string;
    fromName?: string;
    cc?: string | string[];
}

/**
 * Universal sendEmail function that attempts NodeMailer API (Gmail SMTP).
 */
export async function sendEmail(payload: EmailPayload): Promise<void> {
    const recipients = Array.isArray(payload.toEmail) ? payload.toEmail : [payload.toEmail];

    try {
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000');
        const fetchUrl = typeof window !== 'undefined' ? '/api/notify' : `${baseUrl}/api/notify`;
        const response = await fetch(fetchUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                to: recipients,
                cc: payload.cc || ADMIN_EMAIL,
                subject: payload.subject,
                html: payload.htmlBody
            })
        });

        if (response.ok) {
            console.log("[EmailService] Sent via Gmail SMTP API");
            return;
        } else {
            console.error("[EmailService] Gmail SMTP API failed with status", response.status);
        }
    } catch (apiError) {
        console.error("[EmailService] API Route unreachable or error:", apiError);
    }
}

// ── Pre-built notification helpers ────────────────────────────

export async function notifyInterestSent(opts: {
    senderName: string;
    recipientEmail: string;
    recipientName: string;
    icebreaker?: string;
}) {
    await sendEmail({
        toEmail: opts.recipientEmail,
        subject: '💌 New Interest Request – DBohraRishta',
        htmlBody: `
            <div style="font-family:Georgia,serif;max-width:560px;margin:auto;padding:32px;border:1px solid #eee;border-radius:12px">
                <h2 style="color:#881337;margin-bottom:8px">New Interest Request Received</h2>
                <p>As-salaamu alaykum <strong>${opts.recipientName}</strong>,</p>
                <p>You have received a new Interest Request on <strong>DBohraRishta</strong> from
                   <strong>${opts.senderName}</strong>.</p>
                ${opts.icebreaker ? `
                <div style="background:#f9f9f9;padding:14px;border-radius:8px;border-left:3px solid #D4AF37;margin:16px 0">
                    <p style="margin:0;font-style:italic;color:#555">"${opts.icebreaker}"</p>
                </div>` : ''}
                <p>Login to your dashboard to accept or decline this request.</p>
                <a href="https://53dbohrarishta.in" style="display:inline-block;margin-top:20px;background:#881337;color:#fff;padding:12px 24px;text-decoration:none;border-radius:8px;font-weight:bold">
                    Open Dashboard
                </a>
                <hr style="border:0;border-top:1px solid #eee;margin:24px 0"/>
                <p style="font-size:11px;color:#999">DBohraRishta Notification System</p>
            </div>`,
    });
}

export async function notifyRequestAccepted(opts: {
    acceptorName: string;
    acceptorMobile: string;
    acceptorEmail: string;
    requesterEmail: string;
    requesterName: string;
}) {
    await sendEmail({
        toEmail: opts.requesterEmail,
        subject: '🎉 Your Interest was Accepted! – DBohraRishta',
        htmlBody: `
            <div style="font-family:Georgia,serif;max-width:560px;margin:auto;padding:32px;border:1px solid #eee;border-radius:12px">
                <h2 style="color:#881337">Mubarak! Interest Request Accepted 🎊</h2>
                <p>As-salaamu alaykum <strong>${opts.requesterName}</strong>,</p>
                <p><strong>${opts.acceptorName}</strong> has accepted your Interest Request.
                   Their contact details are now visible on your dashboard.</p>
                <div style="background:#f0fdf4;border:1px solid #bbf7d0;padding:16px;border-radius:8px;margin:16px 0">
                    <p style="margin:0 0 6px;font-weight:bold;color:#166534">Contact Details:</p>
                    <p style="margin:0;color:#166534">📞 ${opts.acceptorMobile}</p>
                    <p style="margin:4px 0 0;color:#166534">✉️ ${opts.acceptorEmail}</p>
                </div>
                <a href="https://53dbohrarishta.in" style="display:inline-block;margin-top:20px;background:#881337;color:#fff;padding:12px 24px;text-decoration:none;border-radius:8px;font-weight:bold">
                    Go to Dashboard
                </a>
                <hr style="border:0;border-top:1px solid #eee;margin:24px 0"/>
                <p style="font-size:11px;color:#999">DBohraRishta Notification System</p>
            </div>`,
    });
}

export async function notifyAdminNewRegistration(opts: {
    candidateName: string;
    candidateEmail: string;
    itsNumber?: string;
    gender?: string;
    city?: string;
    isResubmission?: boolean;
}) {
    await sendEmail({
        toEmail: ADMIN_EMAIL,
        subject: opts.isResubmission
            ? `🔄 Profile Resubmitted – ${opts.candidateName}`
            : `🆕 New Registration – ${opts.candidateName}`,
        htmlBody: `
            <div style="font-family:Georgia,serif;max-width:560px;margin:auto;padding:32px;border:1px solid #eee;border-radius:12px">
                <h2 style="color:#881337">${opts.isResubmission ? '🔄 Profile Resubmitted for Verification' : '🆕 New Candidate Registered'}</h2>
                <p>Please review the profile in the admin dashboard.</p>
                <table style="width:100%;border-collapse:collapse;margin:16px 0">
                    <tr><td style="padding:6px 12px;font-weight:bold;color:#555;background:#f9f9f9">Name</td><td style="padding:6px 12px">${opts.candidateName}</td></tr>
                    <tr><td style="padding:6px 12px;font-weight:bold;color:#555;background:#f9f9f9">Email</td><td style="padding:6px 12px">${opts.candidateEmail}</td></tr>
                    ${opts.itsNumber ? `<tr><td style="padding:6px 12px;font-weight:bold;color:#555;background:#f9f9f9">ITS No.</td><td style="padding:6px 12px">${opts.itsNumber}</td></tr>` : ''}
                    ${opts.gender ? `<tr><td style="padding:6px 12px;font-weight:bold;color:#555;background:#f9f9f9">Gender</td><td style="padding:6px 12px;text-transform:capitalize">${opts.gender}</td></tr>` : ''}
                    ${opts.city ? `<tr><td style="padding:6px 12px;font-weight:bold;color:#555;background:#f9f9f9">City</td><td style="padding:6px 12px">${opts.city}</td></tr>` : ''}
                </table>
                <a href="https://53dbohrarishta.in/admin/approvals" style="display:inline-block;background:#881337;color:#fff;padding:12px 24px;text-decoration:none;border-radius:8px;font-weight:bold">
                    Review in Admin Panel
                </a>
                <hr style="border:0;border-top:1px solid #eee;margin:24px 0"/>
                <p style="font-size:11px;color:#999">DBohraRishta Notification System</p>
            </div>`,
    });
}
