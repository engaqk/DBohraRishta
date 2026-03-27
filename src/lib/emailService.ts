import { ADMIN_EMAIL, EmailPayload } from './emailTemplates';
import * as templates from './emailTemplates';

/**
 * Universal sendEmail function that uses the /api/notify route or direct nodemailer.
 * Safe for BOTH CLIENT & SERVER components.
 */
export async function sendEmail(payload: EmailPayload): Promise<void> {
    const recipients = Array.isArray(payload.toEmail) ? payload.toEmail : [payload.toEmail];

    // Filter out internal mobile-auth addresses
    const realRecipients = recipients.filter(email =>
        email && typeof email === 'string' && !email.endsWith('@dbohrarishta.local')
    );

    if (realRecipients.length === 0) return;

    // --- SERVER SIDE DIRECT SEND (Bypasses API fetch for reliability) ---
    if (typeof window === 'undefined') {
        try {
            const { transporter } = await import('./nodemailer');
            const { isEmailBlocked, recordEmailFailure } = await import('./emailStatusServer');

            // Prepare BCC
            const isAdminRecipient = realRecipients.some(r => r.toLowerCase() === ADMIN_EMAIL.toLowerCase());
            const currentBcc = Array.isArray(payload.bcc) ? payload.bcc : (payload.bcc ? [payload.bcc] : []);
            const isAdminBcc = currentBcc.some(r => r.toLowerCase() === ADMIN_EMAIL.toLowerCase());
            let bccFinal = payload.bcc;
            if (!isAdminRecipient && !isAdminBcc) {
                bccFinal = [...currentBcc, ADMIN_EMAIL];
            }

            // prepared recipients based on blocklist
            const activeRecipients: string[] = [];
            for (const email of realRecipients) {
                const blocked = await isEmailBlocked(email);
                if (!blocked || email.toLowerCase().trim() === ADMIN_EMAIL.toLowerCase()) {
                    activeRecipients.push(email);
                }
            }
            if (activeRecipients.length === 0) return;

            const mailOptions = {
                from: `"53DBohraRishta" <${process.env.GMAIL_USER}>`,
                to: activeRecipients.join(', '),
                cc: payload.cc ? (Array.isArray(payload.cc) ? payload.cc.join(', ') : payload.cc) : undefined,
                bcc: bccFinal ? (Array.isArray(bccFinal) ? bccFinal.join(', ') : bccFinal) : undefined,
                subject: payload.subject,
                html: payload.htmlBody,
            };

            const info = await transporter.sendMail(mailOptions);
            console.log('[EmailService] Server-direct email sent:', info.messageId);
            return;
        } catch (serverError: any) {
            console.error("[EmailService] Server-direct send failed:", serverError);
            const { recordEmailFailure } = await import('./emailStatusServer');
            for (const email of realRecipients) {
                await recordEmailFailure(email, serverError?.message || 'Direct Send Error');
            }
        }
    }

    // --- CLIENT SIDE FETCH ---
    try {
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || (typeof window !== 'undefined' ? window.location.origin : '');
        const fetchUrl = typeof window !== 'undefined' ? '/api/notify' : (baseUrl ? `${baseUrl}/api/notify` : '/api/notify');
        
        // Ensure Admin is BCCed on everything unless they are the direct recipient
        const isAdminRecipient = realRecipients.some(r => r.toLowerCase() === ADMIN_EMAIL.toLowerCase());
        const currentBcc = Array.isArray(payload.bcc) ? payload.bcc : (payload.bcc ? [payload.bcc] : []);
        const isAdminBcc = currentBcc.some(r => r.toLowerCase() === ADMIN_EMAIL.toLowerCase());
        
        let bccFinal = payload.bcc;
        if (!isAdminRecipient && !isAdminBcc) {
            bccFinal = [...currentBcc, ADMIN_EMAIL];
        }

        const response = await fetch(fetchUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                to: realRecipients,
                cc: payload.cc,
                bcc: bccFinal,
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
    senderEmail?: string;
    icebreaker?: string;
}) {
    await sendEmail({
        toEmail: opts.recipientEmail,
        subject: `💖 New Interest Request from ${opts.senderName} – 53DBohraRishta`,
        htmlBody: templates.getInterestSentTemplate(opts),
    });
}

export async function notifyRequestAccepted(opts: {
    acceptorName: string;
    acceptorEmail: string;
    acceptorMobile: string;
    requesterName: string;
    requesterEmail: string;
    requesterMobile?: string;
}) {
    await sendEmail({
        toEmail: opts.requesterEmail,
        subject: `🎊 Mubarak! ${opts.acceptorName} accepted your request – 53DBohraRishta`,
        htmlBody: templates.getInterestAcceptedTemplate({
            recipientName: opts.requesterName,
            partnerName: opts.acceptorName,
            mobile: opts.acceptorMobile,
            email: opts.acceptorEmail
        }),
    });
}

export async function notifyInterestDeclined(opts: {
    requesterName: string;
    requesterEmail: string;
    declinerName: string;
    declinerEmail?: string;
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



export async function notifyNewAdminMessage(opts: {
    candidateName: string;
    candidateEmail: string;
    messageSnippet: string;
}) {
    await sendEmail({
        toEmail: opts.candidateEmail,
        subject: `✉️ New Message from Admin – 53DBohraRishta`,
        htmlBody: templates.getAdminMessageTemplate(opts),
    });
}

export { ADMIN_EMAIL };
export type { EmailPayload };
