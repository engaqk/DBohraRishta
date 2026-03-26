import nodemailer from 'nodemailer';

// Gmail SMTP Configuration
export const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.GMAIL_USER?.trim(),
        pass: process.env.GMAIL_APP_PASSWORD?.trim(),
    },
});

export const GMAIL_USER = process.env.GMAIL_USER?.trim();
