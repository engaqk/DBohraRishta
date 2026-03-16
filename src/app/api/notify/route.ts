import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { isEmailBlocked, recordEmailFailure } from '@/lib/emailStatusServer';

export const dynamic = 'force-dynamic';

// Gmail SMTP Configuration
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.GMAIL_USER?.trim(),
        pass: process.env.GMAIL_APP_PASSWORD?.trim(),
    },
});

export async function POST(req: Request) {
    try {
        const { to, cc, bcc, subject, html } = await req.json();

        if (!to || !subject || !html) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
            console.error("Gmail credentials missing in .env. Email not sent.");
            return NextResponse.json({ error: 'Email service not configured on server' }, { status: 503 });
        }

        // 🛡️ Filter recipients based on block list
        const recipients = Array.isArray(to) ? to : [to];
        const activeRecipients: string[] = [];
        
        for (const email of recipients) {
            const blocked = await isEmailBlocked(email);
            if (!blocked) {
                activeRecipients.push(email);
            } else {
                console.warn(`[NotifyAPI] Skipping blocked email: ${email}`);
            }
        }

        if (activeRecipients.length === 0) {
            console.log("[NotifyAPI] All recipients are blocked. Skipping send.");
            return NextResponse.json({ success: true, message: 'Recipients are on bounce blocklist' });
        }

        const mailOptions = {
            from: `"53DBohraRishta" <${process.env.GMAIL_USER}>`,
            to: activeRecipients.join(', '),
            cc: cc ? (Array.isArray(cc) ? cc.join(', ') : cc) : undefined,
            bcc: bcc ? (Array.isArray(bcc) ? bcc.join(', ') : bcc) : undefined,
            subject: subject,
            html: html,
        };

        try {
            const info = await transporter.sendMail(mailOptions);
            console.log('Email sent: ' + info.response);
            return NextResponse.json({ success: true, messageId: info.messageId });
        } catch (sendError: any) {
            // 📝 Record failure for each recipient if it's a delivery error
            const errorMsg = sendError?.message || 'SMTP Send Error';
            console.error("[NotifyAPI] SMTP Error:", errorMsg);
            
            for (const email of activeRecipients) {
                await recordEmailFailure(email, errorMsg);
            }
            
            throw sendError; // Re-throw to be caught by outer catch
        }
    } catch (error: any) {
        console.error("Error sending email via Gmail SMTP:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
