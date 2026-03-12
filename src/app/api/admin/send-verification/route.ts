import { NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebase/admin';
import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.GMAIL_USER?.trim(),
        pass: process.env.GMAIL_APP_PASSWORD?.trim(),
    },
});

export async function POST(request: Request) {
    try {
        const authHeader = request.headers.get('Authorization');
        if (authHeader !== 'secure_admin_session_active') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { uid, email } = await request.json();
        if (!uid || !email) {
            return NextResponse.json({ error: 'Missing uid or email' }, { status: 400 });
        }

        const actionCodeSettings = {
            url: process.env.NEXT_PUBLIC_BASE_URL || 'https://engaqk.github.io/dbohrarishta/',
            handleCodeInApp: false,
        };

        const link = await adminAuth.generateEmailVerificationLink(email, actionCodeSettings);

        const mailOptions = {
            from: `"53DBohraRishta Admin" <${process.env.GMAIL_USER}>`,
            to: email,
            subject: 'Verify your email for 53DBohraRishta',
            html: `
                <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
                    <h2 style="color: #881337;">Email Verification</h2>
                    <p>Hello,</p>
                    <p>An administrator has requested that you verify your email address for 53DBohraRishta. Please click the link below to complete the verification:</p>
                    <a href="${link}" style="display: inline-block; padding: 12px 24px; background-color: #881337; color: white; text-decoration: none; border-radius: 8px; font-weight: bold; margin: 20px 0;">Verify Email Address</a>
                    <p>If you did not expect this email, you can safely ignore it.</p>
                    <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
                    <p style="font-size: 12px; color: #777;">This link will expire soon. Please use it promptly.</p>
                </div>
            `,
        };

        await transporter.sendMail(mailOptions);
        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Error sending verification link:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
