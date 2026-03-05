import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

// Gmail SMTP Configuration
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.GMAIL_USER, // Your Gmail address
        pass: process.env.GMAIL_APP_PASSWORD, // Your Gmail App Password
    },
});

export async function POST(req: Request) {
    try {
        const { to, cc, subject, html } = await req.json();

        if (!to || !subject || !html) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
            console.error("Gmail credentials missing in .env. Email not sent.");
            return NextResponse.json({ error: 'Email service not configured on server' }, { status: 503 });
        }

        const mailOptions = {
            from: `"DBohraRishta" <${process.env.GMAIL_USER}>`,
            to: Array.isArray(to) ? to.join(', ') : to,
            cc: cc ? (Array.isArray(cc) ? cc.join(', ') : cc) : undefined,
            subject: subject,
            html: html,
        };

        const info = await transporter.sendMail(mailOptions);
        console.log('Email sent: ' + info.response);

        return NextResponse.json({ success: true, messageId: info.messageId });
    } catch (error: any) {
        console.error("Error sending email via Gmail SMTP:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
