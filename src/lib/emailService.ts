/**
 * Hybrid Email Notification Service.
 * Uses Gmail SMTP via NodeMailer (/api/notify API route).
 */

export const ADMIN_EMAIL = '53dbohrarishta@gmail.com';

export interface EmailPayload {
    toEmail: string | string[];
    subject: string;
    htmlBody: string;
    fromName?: string;
    cc?: string | string[];
}

/**
 * Universal sendEmail function that uses NodeMailer API (Gmail SMTP).
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

/**
 * Notify both parties when an Interest Request is sent.
 */
export async function notifyInterestSent(opts: {
    senderName: string;
    senderEmail: string;
    recipientEmail: string;
    recipientName: string;
    icebreaker?: string;
}) {
    // 1. Email to Recipient (The person receiving the request)
    await sendEmail({
        toEmail: opts.recipientEmail,
        cc: ADMIN_EMAIL,
        subject: '💌 New Interest Request – 53DBohraRishta',
        htmlBody: `
            <div style="font-family:Georgia,serif;max-width:560px;margin:auto;padding:32px;border:1px solid #eee;border-radius:12px">
                <h2 style="color:#881337;margin-bottom:8px">New Interest Request Received</h2>
                <p>As-salaamu alaykum <strong>${opts.recipientName}</strong>,</p>
                <p>You have received a new Interest Request on <strong>53DBohraRishta</strong> from <strong>${opts.senderName}</strong>.</p>
                ${opts.icebreaker ? `
                <div style="background:#f9f9f9;padding:14px;border-radius:8px;border-left:3px solid #D4AF37;margin:16px 0">
                    <p style="margin:0;font-style:italic;color:#555">"${opts.icebreaker}"</p>
                </div>` : ''}
                <p>Login to your dashboard to review this profile and respond.</p>
                <a href="https://53dbohrarishta.in" style="display:inline-block;margin-top:20px;background:#881337;color:#fff;padding:12px 24px;text-decoration:none;border-radius:8px;font-weight:bold">
                    Open Dashboard
                </a>
                <hr style="border:0;border-top:1px solid #eee;margin:24px 0"/>
                <p style="font-size:11px;color:#999">53DBohraRishta Notification System • CC: ${ADMIN_EMAIL}</p>
            </div>`,
    });

    // 2. Email to Sender (Confirmation that their request was sent)
    await sendEmail({
        toEmail: opts.senderEmail,
        cc: ADMIN_EMAIL,
        subject: '✅ Interest Request Sent – 53DBohraRishta',
        htmlBody: `
            <div style="font-family:Georgia,serif;max-width:560px;margin:auto;padding:32px;border:1px solid #eee;border-radius:12px">
                <h2 style="color:#166534;margin-bottom:8px">Interest Request Successfully Sent</h2>
                <p>As-salaamu alaykum <strong>${opts.senderName}</strong>,</p>
                <p>Your Interest Request to <strong>${opts.recipientName}</strong> has been successfully sent.</p>
                <p>You will be notified via email once they respond to your interest.</p>
                <a href="https://53dbohrarishta.in" style="display:inline-block;margin-top:20px;background:#881337;color:#fff;padding:12px 24px;text-decoration:none;border-radius:8px;font-weight:bold">
                    View Sent Requests
                </a>
                <hr style="border:0;border-top:1px solid #eee;margin:24px 0"/>
                <p style="font-size:11px;color:#999">53DBohraRishta Notification System • CC: ${ADMIN_EMAIL}</p>
            </div>`,
    });
}

/**
 * Notify both parties when an Interest Request is accepted.
 */
export async function notifyRequestAccepted(opts: {
    acceptorName: string;
    acceptorEmail: string;
    acceptorMobile: string;
    requesterName: string;
    requesterEmail: string;
    requesterMobile: string;
}) {
    // 1. Email to Requester (The one who sent the interest)
    await sendEmail({
        toEmail: opts.requesterEmail,
        cc: ADMIN_EMAIL,
        subject: '🎉 Your Interest was Accepted! – 53DBohraRishta',
        htmlBody: `
            <div style="font-family:Georgia,serif;max-width:560px;margin:auto;padding:32px;border:1px solid #eee;border-radius:12px">
                <h2 style="color:#881337">Mubarak! Interest Request Accepted 🎊</h2>
                <p>As-salaamu alaykum <strong>${opts.requesterName}</strong>,</p>
                <p><strong>${opts.acceptorName}</strong> has accepted your Interest Request.</p>
                <div style="background:#f0fdf4;border:1px solid #bbf7d0;padding:20px;border-radius:12px;margin:16px 0">
                    <p style="margin:0 0 10px;font-weight:bold;color:#166534;font-size:16px underline">Their Contact Details:</p>
                    <p style="margin:0;color:#166534;font-size:15px">📞 Mobile: <strong>${opts.acceptorMobile}</strong></p>
                    <p style="margin:8px 0 0;color:#166534;font-size:15px">✉️ Email: <strong>${opts.acceptorEmail}</strong></p>
                </div>
                <p>You can now contact them directly to proceed with family discussions.</p>
                <hr style="border:0;border-top:1px solid #eee;margin:24px 0"/>
                <p style="font-size:11px;color:#999">53DBohraRishta Notification System • CC: ${ADMIN_EMAIL}</p>
            </div>`,
    });

    // 2. Email to Acceptor (The one who clicked accept)
    await sendEmail({
        toEmail: opts.acceptorEmail,
        cc: ADMIN_EMAIL,
        subject: '🤝 Connection Established – 53DBohraRishta',
        htmlBody: `
            <div style="font-family:Georgia,serif;max-width:560px;margin:auto;padding:32px;border:1px solid #eee;border-radius:12px">
                <h2 style="color:#881337">Connection Established 🤝</h2>
                <p>As-salaamu alaykum <strong>${opts.acceptorName}</strong>,</p>
                <p>You have successfully accepted the interest from <strong>${opts.requesterName}</strong>.</p>
                <div style="background:#f0fdf4;border:1px solid #bbf7d0;padding:20px;border-radius:12px;margin:16px 0">
                    <p style="margin:0 0 10px;font-weight:bold;color:#166534;font-size:16px underline">Their Contact Details:</p>
                    <p style="margin:0;color:#166534;font-size:15px">📞 Mobile: <strong>${opts.requesterMobile}</strong></p>
                    <p style="margin:8px 0 0;color:#166534;font-size:15px">✉️ Email: <strong>${opts.requesterEmail}</strong></p>
                </div>
                <p>Their details are also permanently available in your "Accepted" section on the dashboard.</p>
                <hr style="border:0;border-top:1px solid #eee;margin:24px 0"/>
                <p style="font-size:11px;color:#999">53DBohraRishta Notification System • CC: ${ADMIN_EMAIL}</p>
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
                <p style="font-size:11px;color:#999">53DBohraRishta Notification System</p>
            </div>`,
    });
}

/**
 * Notify Candidate that their profile status has changed (Verified, Rejected, etc).
 */
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
        hold: "Profile Put On Hold"
    };
    const statusLabel = statusLabels[opts.newStatus] || opts.newStatus;

    await sendEmail({
        toEmail: opts.candidateEmail,
        cc: ADMIN_EMAIL,
        subject: `🚨 Profile Status Update: ${statusLabel} – 53DBohraRishta`,
        htmlBody: `
            <div style="font-family:Georgia,serif;max-width:560px;margin:auto;padding:32px;border:1px solid #eee;border-radius:12px">
                <h2 style="color:#881337">Profile Status Update</h2>
                <p>As-salaamu alaykum <strong>${opts.candidateName}</strong>,</p>
                <p>Your profile status on <strong>53DBohraRishta</strong> has been updated by the administration.</p>
                <div style="background:#fef2f2;border-left:5px solid #881337;padding:20px;border-radius:8px;margin:20px 0">
                    <p style="margin:0;font-weight:bold;color:#881337;font-size:16px">New Status: ${statusLabel}</p>
                    ${opts.adminMessage ? `<p style="margin:12px 0 0;color:#555;font-style:italic">" ${opts.adminMessage} "</p>` : ''}
                </div>
                <p>Please login to your dashboard to view your status and any required next steps.</p>
                <a href="https://53dbohrarishta.in" style="display:inline-block;margin-top:20px;background:#881337;color:#fff;padding:12px 24px;text-decoration:none;border-radius:8px;font-weight:bold">
                    Go to Dashboard
                </a>
                <hr style="border:0;border-top:1px solid #eee;margin:24px 0"/>
                <p style="font-size:11px;color:#999">53DBohraRishta Official Notification • CC: ${ADMIN_EMAIL}</p>
            </div>`,
    });
}

/**
 * Notify Candidate that they have a new message from the Admin.
 */
export async function notifyNewAdminMessage(opts: {
    candidateName: string;
    candidateEmail: string;
    messageSnippet: string;
}) {
    await sendEmail({
        toEmail: opts.candidateEmail,
        cc: ADMIN_EMAIL,
        subject: '💬 New Message from Administration – 53DBohraRishta',
        htmlBody: `
            <div style="font-family:Georgia,serif;max-width:560px;margin:auto;padding:32px;border:1px solid #eee;border-radius:12px">
                <h2 style="color:#881337">Message from Administration</h2>
                <p>As-salaamu alaykum <strong>${opts.candidateName}</strong>,</p>
                <p>You have received a new message from the <strong>53DBohraRishta</strong> administration thread.</p>
                <div style="background:#f9f9f9;padding:16px;border-radius:8px;border:1px solid #eee;margin:16px 0;color:#333">
                    <p style="margin:0;font-style:italic">"${opts.messageSnippet.length > 100 ? opts.messageSnippet.substring(0, 100) + '...' : opts.messageSnippet}"</p>
                </div>
                <p>Login to your dashboard to reply and continue the discussion.</p>
                <a href="https://53dbohrarishta.in" style="display:inline-block;margin-top:20px;background:#881337;color:#fff;padding:12px 24px;text-decoration:none;border-radius:8px;font-weight:bold">
                    View Message Room
                </a>
                <hr style="border:0;border-top:1px solid #eee;margin:24px 0"/>
                <p style="font-size:11px;color:#999">53DBohraRishta Official Notification • CC: ${ADMIN_EMAIL}</p>
            </div>`,
    });
}

/**
 * Notify Candidate that their registration form has been received and is under review.
 */
export async function notifyUserRegistrationReceived(opts: {
    candidateName: string;
    candidateEmail: string;
    itsNumber: string;
}) {
    await sendEmail({
        toEmail: opts.candidateEmail,
        cc: ADMIN_EMAIL,
        subject: '✅ Registration Received – 53DBohraRishta',
        htmlBody: `
            <div style="font-family:Georgia,serif;max-width:560px;margin:auto;padding:32px;border:1px solid #eee;border-radius:12px">
                <h2 style="color:#881337">Form Submitted Successfully</h2>
                <p>As-salaamu alaykum <strong>${opts.candidateName}</strong>,</p>
                <p>Mubarak! Your comprehensive biodata form (ITS: <strong>${opts.itsNumber}</strong>) has been received by the <strong>53DBohraRishta</strong> team.</p>
                <div style="background:#fdf2f2;padding:20px;border-radius:8px;margin:20px 0;border-left:5px solid #D4AF37">
                    <p style="margin:0;font-weight:bold;color:#881337">What happens next?</p>
                    <p style="margin:10px 0 0;font-size:14px;color:#555">Our administration will review your details and verification photos. You will receive an email once your profile is <strong>Verified & Approved</strong> for the discovery platform.</p>
                </div>
                <p>In the meantime, you can log in to your dashboard to complete any missing details or update your photos.</p>
                <a href="https://53dbohrarishta.in" style="display:inline-block;margin-top:20px;background:#881337;color:#fff;padding:12px 24px;text-decoration:none;border-radius:8px;font-weight:bold">
                    Go to Dashboard
                </a>
                <hr style="border:0;border-top:1px solid #eee;margin:24px 0"/>
                <p style="font-size:11px;color:#999">53DBohraRishta Official Notification • CC: ${ADMIN_EMAIL}</p>
            </div>`,
    });
}

/**
 * Notify both parties when an Interest Request is declined.
 */
export async function notifyInterestDeclined(opts: {
    declinerName: string;
    declinerEmail: string;
    requesterName: string;
    requesterEmail: string;
}) {
    // Email to Requester
    await sendEmail({
        toEmail: opts.requesterEmail,
        cc: ADMIN_EMAIL,
        subject: 'Interest Update – 53DBohraRishta',
        htmlBody: `
            <div style="font-family:Georgia,serif;max-width:560px;margin:auto;padding:32px;border:1px solid #eee;border-radius:12px">
                <h2 style="color:#555">Interest Request Update</h2>
                <p>As-salaamu alaykum <strong>${opts.requesterName}</strong>,</p>
                <p>Regarding your Interest Request sent to <strong>${opts.declinerName}</strong>, they are unable to proceed at this time and have declined the request.</p>
                <p>Don't worry, there are many other suitable profiles waiting for you! Keep exploring.</p>
                <hr style="border:0;border-top:1px solid #eee;margin:24px 0"/>
                <p style="font-size:11px;color:#999">53DBohraRishta Notification System • CC: ${ADMIN_EMAIL}</p>
            </div>`,
    });

    // Confirmation Email to Decliner
    await sendEmail({
        toEmail: opts.declinerEmail,
        cc: ADMIN_EMAIL,
        subject: 'Request Declined Confirmation',
        htmlBody: `
            <div style="font-family:Georgia,serif;max-width:560px;margin:auto;padding:32px;border:1px solid #eee;border-radius:12px">
                <h2 style="color:#555">Request Declined</h2>
                <p>As-salaamu alaykum <strong>${opts.declinerName}</strong>,</p>
                <p>You have declined the Interest Request from <strong>${opts.requesterName}</strong>. They have been notified politely.</p>
                <hr style="border:0;border-top:1px solid #eee;margin:24px 0"/>
                <p style="font-size:11px;color:#999">53DBohraRishta Notification System • CC: ${ADMIN_EMAIL}</p>
            </div>`,
    });
}
