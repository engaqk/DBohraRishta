import { transporter, GMAIL_USER as NODEMAILER_USER } from './nodemailer';
import { isEmailBlocked, recordEmailFailure } from './emailStatusServer';

export const ADMIN_EMAIL = '53dbohrarishta@gmail.com';


export interface EmailPayload {
    toEmail: string | string[];
    subject: string;
    htmlBody: string;
    fromName?: string;
    cc?: string | string[];
    bcc?: string | string[];
}

/**
 * Universal sendEmail function that uses NodeMailer API (Gmail SMTP).
 *
 * GUARD: If ALL recipients are mobile-only accounts (@dbohrarishta.local),
 * the email is silently skipped — the user hasn't provided a real email yet.
 * Only real email addresses (submitted via onboarding form) will receive notifications.
 */
export async function sendEmail(payload: EmailPayload): Promise<void> {
    const recipients = Array.isArray(payload.toEmail) ? payload.toEmail : [payload.toEmail];

    // Filter out internal mobile-auth addresses
    const realRecipients = recipients.filter(email =>
        email && typeof email === 'string' && !email.endsWith('@dbohrarishta.local')
    );

    if (realRecipients.length === 0) {
        // All recipients are mobile-only users — no real email yet
        console.warn(
            `[EmailService] Skipped email "${payload.subject}" — recipient(s) are mobile-only users without a verified email address yet.`
        );
        return;
    }

    // Server-side check
    const isServer = typeof window === 'undefined';

    if (isServer) {
        // DIRECT SEND ON SERVER: Bypasses /api/notify and directly uses transporter
        // This is MUCH more reliable on Vercel/Production than using localhost fetch
        try {
            console.log(`[EmailService] Direct sending server-side: "${payload.subject}"`);
            
            // Filter recipients against blocklist
            const activeRecipients: string[] = [];
            for (const email of realRecipients) {
                const blocked = await isEmailBlocked(email);
                if (!blocked) activeRecipients.push(email);
                else console.warn(`[EmailService] Skipping blocked email: ${email}`);
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
            console.log('[EmailService] Direct mail sent response:', info.response);
            return;
        } catch (serverError: any) {
            const msg = serverError.message || 'Unknown Server Error';
            console.error("[EmailService] Direct SMTP failed:", msg);
            // Record failure
            for(const email of realRecipients) {
               await recordEmailFailure(email, msg);
            }
            // Optional: fallback to fetch if direct failed? 
            // Usually if direct failed, fetch from same server will also fail, but maybe...
        }
    }

    // Client-side fallback or Fetch fallback
    try {
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000');
        const fetchUrl = typeof window !== 'undefined' ? '/api/notify' : `${baseUrl}/api/notify`;
        const response = await fetch(fetchUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                to: realRecipients,
                cc: payload.cc,
                bcc: payload.bcc || (payload.cc ? undefined : ADMIN_EMAIL),
                subject: payload.subject,
                html: payload.htmlBody
            })
        });

        if (response.ok) {
            console.log("[EmailService] Sent via Gmail SMTP API (fetch)");
            return;
        } else {
            console.error("[EmailService] API Route failed status", response.status);
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
        bcc: ADMIN_EMAIL,
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
                <p style="font-size:11px;color:#999">53DBohraRishta Notification System</p>
            </div>`,
    });

    // 2. Email to Sender (Confirmation that their request was sent)
    await sendEmail({
        toEmail: opts.senderEmail,
        bcc: ADMIN_EMAIL,
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
                <p style="font-size:11px;color:#999">53DBohraRishta Notification System</p>
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
        bcc: ADMIN_EMAIL,
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
                <a href="https://53dbohrarishta.in" style="display:inline-block;margin-top:20px;background:#881337;color:#fff;padding:12px 24px;text-decoration:none;border-radius:8px;font-weight:bold">
                    Go to Dashboard
                </a>
                <hr style="border:0;border-top:1px solid #eee;margin:24px 0"/>
                <p style="font-size:11px;color:#999">53DBohraRishta Notification System</p>
            </div>`,
    });

    // 2. Email to Acceptor (The one who clicked accept)
    await sendEmail({
        toEmail: opts.acceptorEmail,
        bcc: ADMIN_EMAIL,
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
                <a href="https://53dbohrarishta.in" style="display:inline-block;margin-top:20px;background:#881337;color:#fff;padding:12px 24px;text-decoration:none;border-radius:8px;font-weight:bold">
                    Go to Dashboard
                </a>
                <hr style="border:0;border-top:1px solid #eee;margin:24px 0"/>
                <p style="font-size:11px;color:#999">53DBohraRishta Notification System</p>
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
        bcc: ADMIN_EMAIL,
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
                <p style="font-size:11px;color:#999">53DBohraRishta Official Notification</p>
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
        bcc: ADMIN_EMAIL,
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
                <p style="font-size:11px;color:#999">53DBohraRishta Official Notification</p>
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
        bcc: ADMIN_EMAIL,
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
                <p style="font-size:11px;color:#999">53DBohraRishta Official Notification</p>
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
        bcc: ADMIN_EMAIL,
        subject: 'Interest Update – 53DBohraRishta',
        htmlBody: `
            <div style="font-family:Georgia,serif;max-width:560px;margin:auto;padding:32px;border:1px solid #eee;border-radius:12px">
                <h2 style="color:#555">Interest Request Update</h2>
                <p>As-salaamu alaykum <strong>${opts.requesterName}</strong>,</p>
                <p>Regarding your Interest Request sent to <strong>${opts.declinerName}</strong>, they are unable to proceed at this time and have declined the request.</p>
                <p>Don't worry, there are many other suitable profiles waiting for you! Keep exploring.</p>
                <a href="https://53dbohrarishta.in" style="display:inline-block;margin-top:20px;background:#881337;color:#fff;padding:12px 24px;text-decoration:none;border-radius:8px;font-weight:bold">
                    Explore More Profiles
                </a>
                <hr style="border:0;border-top:1px solid #eee;margin:24px 0"/>
                <p style="font-size:11px;color:#999">53DBohraRishta Notification System</p>
            </div>`,
    });

    // Confirmation Email to Decliner
    await sendEmail({
        toEmail: opts.declinerEmail,
        bcc: ADMIN_EMAIL,
        subject: 'Request Declined Confirmation',
        htmlBody: `
            <div style="font-family:Georgia,serif;max-width:560px;margin:auto;padding:32px;border:1px solid #eee;border-radius:12px">
                <h2 style="color:#555">Request Declined</h2>
                <p>As-salaamu alaykum <strong>${opts.declinerName}</strong>,</p>
                <p>You have declined the Interest Request from <strong>${opts.requesterName}</strong>. They have been notified politely.</p>
                <a href="https://53dbohrarishta.in" style="display:inline-block;margin-top:20px;background:#881337;color:#fff;padding:12px 24px;text-decoration:none;border-radius:8px;font-weight:bold">
                    Back to Dashboard
                </a>
                <hr style="border:0;border-top:1px solid #eee;margin:24px 0"/>
                <p style="font-size:11px;color:#999">53DBohraRishta Notification System</p>
            </div>`,
    });
}

/**
 * Notify Candidate of Duplicate Registration Attempt.
 */
export async function notifyDuplicateRegistration(opts: {
    candidateName: string;
    candidateEmail: string;
    itsNumber: string;
}) {
    await sendEmail({
        toEmail: opts.candidateEmail,
        bcc: ADMIN_EMAIL,
        subject: `⚠️ Duplicate Registration Attempt – 53DBohraRishta`,
        htmlBody: `
            <div style="font-family:Georgia,serif;max-width:560px;margin:auto;padding:32px;border:1px solid #eee;border-radius:12px">
                <h2 style="color:#881337">Duplicate Registration Attempt</h2>
                <p>As-salaamu alaykum <strong>${opts.candidateName}</strong>,</p>
                <p>We noticed an attempt to register a new profile using the ITS Number <strong>${opts.itsNumber}</strong>.</p>
                <div style="background:#fef2f2;border-left:5px solid #881337;padding:20px;border-radius:8px;margin:20px 0">
                    <p style="margin:0;color:#555;font-size:15px">You are already registered. Please edit your existing profile instead of refilling the form, as duplicate registrations are not permitted.</p>
                </div>
                <p>If you need access to your profile, please login to your dashboard.</p>
                <a href="https://53dbohrarishta.in/login" style="display:inline-block;margin-top:20px;background:#881337;color:#fff;padding:12px 24px;text-decoration:none;border-radius:8px;font-weight:bold">
                    Login to Dashboard
                </a>
                <hr style="border:0;border-top:1px solid #eee;margin:24px 0"/>
                <p style="font-size:11px;color:#999">53DBohraRishta Official Notification</p>
            </div>`,
    });
}

/**
 * Dual-purpose welcome email:
 * - isReminder: true  → "Complete your profile" reminder for email/Google users who haven't submitted onboarding yet
 * - isReminder: false → "Profile submitted" confirmation sent once after onboarding form is submitted
 * Mobile-only users (@dbohrarishta.local) are automatically blocked by the sendEmail guard.
 */
export async function notifyWelcomeOnboarding(opts: {
    candidateName?: string;
    candidateEmail: string;
    isReminder?: boolean;
}) {
    const isReminder = opts.isReminder ?? false;

    await sendEmail({
        toEmail: opts.candidateEmail,
        bcc: ADMIN_EMAIL,
        subject: isReminder
            ? `✨ Complete Your Profile & Find Your Perfect Match – 53DBohraRishta`
            : `✅ Profile Submitted Successfully – 53DBohraRishta`,
        htmlBody: isReminder ? `
            <div style="font-family:Georgia,serif;max-width:560px;margin:auto;padding:32px;border:1px solid #eee;border-radius:12px">
                <h2 style="color:#881337;margin-bottom:8px">Welcome to 53DBohraRishta ✨</h2>
                <p>As-salaamu alaykum <strong>${opts.candidateName || 'Candidate'}</strong>,</p>
                <p>Khushamadeed! You recently joined our platform but haven't completed your onboarding yet.</p>
                <div style="background:#f9f9f9;border-left:5px solid #D4AF37;padding:20px;border-radius:8px;margin:20px 0">
                    <p style="margin:0;font-size:15px;color:#333">Complete your profile today to start discovering matches within our community <strong>free of cost</strong>. Get benefited from all our premium features including photo privacy and direct interest requests.</p>
                </div>
                <p>It only takes 2 minutes to get started!</p>
                <a href="https://53dbohrarishta.in/login" style="display:inline-block;margin-top:20px;background:#881337;color:#fff;padding:12px 24px;text-decoration:none;border-radius:8px;font-weight:bold">
                    Complete Onboarding Now
                </a>
                <hr style="border:0;border-top:1px solid #eee;margin:24px 0"/>
                <p style="font-size:11px;color:#999">53DBohraRishta Official Notification</p>
            </div>` : `
            <div style="font-family:Georgia,serif;max-width:560px;margin:auto;padding:32px;border:1px solid #eee;border-radius:12px">
                <h2 style="color:#881337;margin-bottom:8px">Profile Received! ✅</h2>
                <p>As-salaamu alaykum <strong>${opts.candidateName || 'Candidate'}</strong>,</p>
                <p>JazakAllah Khair! Your profile on <strong>53DBohraRishta</strong> has been successfully submitted and is currently <strong>pending admin verification</strong>.</p>
                <div style="background:#f9f9f9;border-left:5px solid #D4AF37;padding:20px;border-radius:8px;margin:20px 0">
                    <p style="margin:0;font-size:15px;color:#333">Once your profile is verified by the admin team, you will be able to discover matches and receive interest requests from the community.</p>
                </div>
                <p>You will receive another notification once your profile is approved.</p>
                <a href="https://53dbohrarishta.in" style="display:inline-block;margin-top:20px;background:#881337;color:#fff;padding:12px 24px;text-decoration:none;border-radius:8px;font-weight:bold">
                    View My Profile
                </a>
                <hr style="border:0;border-top:1px solid #eee;margin:24px 0"/>
                <p style="font-size:11px;color:#999">53DBohraRishta Official Notification</p>
            </div>`,
    });
}

/**
 * Send an OTP code via Email
 */
export async function sendVerificationEmail(opts: {
    toEmail: string;
    otpCode: string;
}) {
    await sendEmail({
        toEmail: opts.toEmail,
        subject: `🔒 ${opts.otpCode} is your verification code - 53DBohraRishta`,
        htmlBody: `
            <div style="font-family:Georgia,serif;max-width:560px;margin:auto;padding:32px;border:1px solid #eee;border-radius:12px">
                <h2 style="color:#881337;margin-bottom:8px">Verification Code</h2>
                <p>As-salaamu alaykum,</p>
                <p>Your verification code for <strong>53DBohraRishta</strong> is:</p>
                <div style="background:#f9f9f9;border-left:5px solid #D4AF37;padding:20px;border-radius:8px;margin:20px 0;text-align:center;">
                    <span style="font-size:32px;font-weight:bold;letter-spacing:10px;color:#333;">${opts.otpCode}</span>
                </div>
                <p>This code will expire in 5 minutes. Do not share this code with anyone.</p>
                <p style="font-size:11px;color:#999;margin-top:30px;">If you did not request this code, please ignore this email.</p>
            </div>`,
    });
}

