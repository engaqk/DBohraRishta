import { ADMIN_EMAIL, EmailPayload } from './emailTemplates';
import * as templates from './emailTemplates';

/**
 * Universal sendEmail function that uses the /api/notify route.
 * Safe for CLIENT components.
 */
export async function sendEmail(payload: EmailPayload): Promise<void> {
    const recipients = Array.isArray(payload.toEmail) ? payload.toEmail : [payload.toEmail];

    // Filter out internal mobile-auth addresses
    const realRecipients = recipients.filter(email =>
        email && typeof email === 'string' && !email.endsWith('@dbohrarishta.local')
    );

    if (realRecipients.length === 0) return;

    try {
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || (typeof window !== 'undefined' ? window.location.origin : '');
        const fetchUrl = typeof window !== 'undefined' ? '/api/notify' : (baseUrl ? `${baseUrl}/api/notify` : '/api/notify');
        
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

        if (!response.ok) {
            console.error("[EmailService] API Route failed status", response.status);
        }
    } catch (apiError) {
        console.error("[EmailService] API Route unreachable or error:", apiError);
    }
}

// ── Notification Helpers (Client Safe) ────────────────────────────

export async function notifyAdminNewRegistration(opts: {
    candidateName: string;
    candidateEmail: string;
    itsNumber?: string;
    gender?: string;
    city?: string;
    isResubmission?: boolean;
    onboardingStatus?: 'pending' | 'submitted';
}) {
    const isPending = opts.onboardingStatus === 'pending';
    const sub = opts.isResubmission ? `🔄 Profile Resubmitted – ${opts.candidateName}` : (isPending ? `⏳ Onboarding Started – ${opts.candidateName}` : `🆕 New Registration – ${opts.candidateName}`);
    
    await sendEmail({
        toEmail: ADMIN_EMAIL,
        subject: sub,
        htmlBody: templates.getAdminNotifyTemplate(opts),
    });
}

export async function notifyInterestSent(opts: {
    recipientName: string;
    recipientEmail: string;
    senderName: string;
    icebreaker?: string;
}) {
    await sendEmail({
        toEmail: opts.recipientEmail,
        subject: `💖 New Interest Request from ${opts.senderName} – 53DBohraRishta`,
        htmlBody: templates.getInterestSentTemplate(opts),
    });
}

export async function notifyRequestAccepted(opts: {
    recipientName: string;
    recipientEmail: string;
    partnerName: string;
    mobile: string;
    email: string;
}) {
    await sendEmail({
        toEmail: opts.recipientEmail,
        subject: `🎊 Mubarak! ${opts.partnerName} accepted your request – 53DBohraRishta`,
        htmlBody: templates.getInterestAcceptedTemplate(opts),
    });
}

export async function notifyInterestDeclined(opts: {
    requesterName: string;
    requesterEmail: string;
    declinerName: string;
}) {
    await sendEmail({
        toEmail: opts.requesterEmail,
        subject: 'Update on your Interest Request – 53DBohraRishta',
        htmlBody: templates.getInterestDeclinedTemplate(opts),
    });
}

export async function notifyWelcomeOnboarding(opts: {
    candidateName?: string;
    candidateEmail: string;
    isReminder?: boolean;
}) {
    await sendEmail({
        toEmail: opts.candidateEmail,
        subject: opts.isReminder ? '✨ Complete Your Profile – 53DBohraRishta' : '✅ Profile Submitted Successfully – 53DBohraRishta',
        htmlBody: templates.getWelcomeOnboardingTemplate({ candidateName: opts.candidateName || 'Candidate', isReminder: !!opts.isReminder }),
    });
}

export async function notifyDuplicateRegistration(opts: {
    candidateName: string;
    candidateEmail: string;
    itsNumber: string;
}) {
    await sendEmail({
        toEmail: opts.candidateEmail,
        subject: '⚠️ Duplicate Registration Attempt – 53DBohraRishta',
        htmlBody: templates.getDuplicateRegistrationTemplate(opts),
    });
}

export async function notifyUserRegistrationReceived(opts: {
    candidateName: string;
    candidateEmail: string;
    itsNumber: string;
}) {
    await sendEmail({
        toEmail: opts.candidateEmail,
        subject: '✅ Registration Received – 53DBohraRishta',
        htmlBody: `<h3>Form Submitted Successfully</h3><p>Your ITS: ${opts.itsNumber} has been received.</p>`,
    });
}



export { ADMIN_EMAIL };
export type { EmailPayload };
