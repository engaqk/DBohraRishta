/**
 * emailTemplates.ts
 * Shared email HTML templates for BohraShaadi.
 * Safe for use in both Client and Server components.
 */

export const ADMIN_EMAIL = '53dbohrarishta@gmail.com';

export interface EmailPayload {
    toEmail: string | string[];
    subject: string;
    htmlBody: string;
    fromName?: string;
    cc?: string | string[];
    bcc?: string | string[];
}

export function getInterestSentTemplate(opts: { recipientName: string; senderName: string; icebreaker?: string }) {
    return `
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
        </div>`;
}

export function getInterestAcceptedTemplate(opts: { recipientName: string; partnerName: string; mobile: string; email: string }) {
    return `
        <div style="font-family:Georgia,serif;max-width:560px;margin:auto;padding:32px;border:1px solid #eee;border-radius:12px">
            <h2 style="color:#881337">Mubarak! Interest Request Accepted 🎊</h2>
            <p>As-salaamu alaykum <strong>${opts.recipientName}</strong>,</p>
            <p><strong>${opts.partnerName}</strong> has accepted your Interest Request.</p>
            <div style="background:#f0fdf4;border:1px solid #bbf7d0;padding:20px;border-radius:12px;margin:16px 0">
                <p style="margin:0 0 10px;font-weight:bold;color:#166534;font-size:16px underline">Their Contact Details:</p>
                <p style="margin:0;color:#166534;font-size:15px">📞 Mobile: <strong>${opts.mobile}</strong></p>
                <p style="margin:8px 0 0;color:#166534;font-size:15px">✉️ Email: <strong>${opts.email}</strong></p>
            </div>
            <p>You can now contact them directly to proceed with family discussions.</p>
            <a href="https://53dbohrarishta.in" style="display:inline-block;margin-top:20px;background:#881337;color:#fff;padding:12px 24px;text-decoration:none;border-radius:8px;font-weight:bold">
                Go to Dashboard
            </a>
            <hr style="border:0;border-top:1px solid #eee;margin:24px 0"/>
            <p style="font-size:11px;color:#999">53DBohraRishta Notification System</p>
        </div>`;
}

export function getAdminNotifyTemplate(opts: { 
    candidateName: string; 
    candidateEmail: string; 
    itsNumber?: string; 
    gender?: string; 
    city?: string; 
    isResubmission?: boolean;
    onboardingStatus?: 'pending' | 'submitted';
}) {
    const isPending = opts.onboardingStatus === 'pending';
    const title = opts.isResubmission 
        ? '🔄 Profile Resubmitted' 
        : (isPending ? '⏳ New Onboarding Started' : '🆕 New Candidate Registered');

    return `
        <div style="font-family:Georgia,serif;max-width:560px;margin:auto;padding:32px;border:1px solid #eee;border-radius:12px">
            <h2 style="color:#881337">${title}</h2>
            <p>${isPending ? 'A candidate has completed <strong>Step 1</strong> of onboarding but hasn\'t finished Step 2 yet.' : 'The candidate has <strong>completed</strong> onboarding and is waiting for verification.'}</p>
            <table style="width:100%;border-collapse:collapse;margin:16px 0">
                <tr><td style="padding:6px 12px;font-weight:bold;color:#555;background:#f9f9f9">Name</td><td style="padding:6px 12px">${opts.candidateName}</td></tr>
                <tr><td style="padding:6px 12px;font-weight:bold;color:#555;background:#f9f9f9">Email</td><td style="padding:6px 12px">${opts.candidateEmail}</td></tr>
                <tr><td style="padding:6px 12px;font-weight:bold;color:#555;background:#f9f9f9">Status</td><td style="padding:6px 12px font-weight:bold; color:${isPending ? '#indigo-600' : '#059669'}">${isPending ? 'ONBOARDING PENDING' : 'SUBMITTED (WAIT APPROVAL)'}</td></tr>
                ${opts.itsNumber ? `<tr><td style="padding:6px 12px;font-weight:bold;color:#555;background:#f9f9f9">ITS No.</td><td style="padding:6px 12px">${opts.itsNumber}</td></tr>` : ''}
                ${opts.gender ? `<tr><td style="padding:6px 12px;font-weight:bold;color:#555;background:#f9f9f9">Gender</td><td style="padding:6px 12px;text-transform:capitalize">${opts.gender}</td></tr>` : ''}
                ${opts.city ? `<tr><td style="padding:6px 12px;font-weight:bold;color:#555;background:#f9f9f9">City</td><td style="padding:6px 12px">${opts.city}</td></tr>` : ''}
            </table>
            <a href="https://53dbohrarishta.in/admin/users" style="display:inline-block;background:#881337;color:#fff;padding:12px 24px;text-decoration:none;border-radius:8px;font-weight:bold">
                Review in Admin Panel
            </a>
            <hr style="border:0;border-top:1px solid #eee;margin:24px 0"/>
            <p style="font-size:11px;color:#999">53DBohraRishta Notification System</p>
        </div>`;
}


export function getStatusUpdateTemplate(opts: { candidateName: string; statusLabel: string; adminMessage?: string }) {
    return `
        <div style="font-family:Georgia,serif;max-width:560px;margin:auto;padding:32px;border:1px solid #eee;border-radius:12px">
            <h2 style="color:#881337">Profile Status Update</h2>
            <p>As-salaamu alaykum <strong>${opts.candidateName}</strong>,</p>
            <p>Your profile status on <strong>53DBohraRishta</strong> has been updated by the administration.</p>
            <div style="background:#fef2f2;border-left:5px solid #881337;padding:20px;border-radius:8px;margin:20px 0">
                <p style="margin:0;font-weight:bold;color:#881337;font-size:16px">New Status: ${opts.statusLabel}</p>
                ${opts.adminMessage ? `<p style="margin:12px 0 0;color:#555;font-style:italic">" ${opts.adminMessage} "</p>` : ''}
            </div>
            <p>Please login to your dashboard to view your status and any required next steps.</p>
            <a href="https://53dbohrarishta.in" style="display:inline-block;margin-top:20px;background:#881337;color:#fff;padding:12px 24px;text-decoration:none;border-radius:8px;font-weight:bold">
                Go to Dashboard
            </a>
            <hr style="border:0;border-top:1px solid #eee;margin:24px 0"/>
            <p style="font-size:11px;color:#999">53DBohraRishta Official Notification</p>
        </div>`;
}

export function getDuplicateRegistrationTemplate(opts: { candidateName: string; itsNumber: string }) {
    return `
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
        </div>`;
}

export function getWelcomeOnboardingTemplate(opts: { candidateName: string; isReminder: boolean }) {
    return opts.isReminder ? `
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
        </div>`;
}

export function getInterestDeclinedTemplate(opts: { requesterName: string; declinerName: string }) {
    return `
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
        </div>`;
}

export function getVerificationEmailTemplate(opts: { otpCode: string }) {
    return `
        <div style="font-family:Georgia,serif;max-width:560px;margin:auto;padding:32px;border:1px solid #eee;border-radius:12px">
            <h2 style="color:#881337;margin-bottom:8px">Verification Code</h2>
            <p>As-salaamu alaykum,</p>
            <p>Your verification code for <strong>53DBohraRishta</strong> is:</p>
            <div style="background:#f9f9f9;border-left:5px solid #D4AF37;padding:20px;border-radius:8px;margin:20px 0;text-align:center;">
                <span style="font-size:32px;font-weight:bold;letter-spacing:10px;color:#333;">${opts.otpCode}</span>
            </div>
            <p>This code will expire in 5 minutes. Do not share this code with anyone.</p>
            <p style="font-size:11px;color:#999;margin-top:30px;">If you did not request this code, please ignore this email.</p>
        </div>`;
}
