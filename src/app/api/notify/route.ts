import { Resend } from 'resend';
import { NextResponse } from 'next/server';

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

export async function POST(req: Request) {
    try {
        const { to, subject, html } = await req.json();

        if (!to || !subject || !html) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        if (!resend) {
            console.error("Resend API key missing. Email not sent.");
            return NextResponse.json({ error: 'Email service not configured' }, { status: 503 });
        }

        const { data, error } = await resend.emails.send({
            from: 'DBohraRishta <notifications@dbohrarishta.com>',
            to,
            subject,
            html,
        });

        if (error) {
            return NextResponse.json({ error }, { status: 500 });
        }

        return NextResponse.json({ success: true, data });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
