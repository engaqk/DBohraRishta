import { NextResponse } from 'next/server';
import { normalizePhone } from '@/lib/phoneUtils';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
    try {
        const { phone: rawPhone, message } = await req.json();
        const phone = normalizePhone(rawPhone);

        if (!phone || !message) {
            return NextResponse.json({ error: 'Valid phone and message are required' }, { status: 400 });
        }

        const deviceId = process.env.TEXTBEE_DEVICE_ID;
        const apiKey = process.env.TEXTBEE_API_KEY;

        if (!deviceId || !apiKey) {
            console.error("Textbee credentials missing for SMS notification");
            return NextResponse.json({ error: 'SMS service not configured' }, { status: 500 });
        }

        const { default: axios } = await import('axios');
        const response = await axios.post(
            `https://api.textbee.dev/api/v1/gateway/devices/${deviceId}/send-sms`,
            {
                recipients: [phone],
                message: message,
            },
            {
                headers: {
                    'x-api-key': apiKey,
                    'Content-Type': 'application/json',
                },
            }
        );

        console.log('[SMS Notify] Sent to', phone, ':', response.data);
        return NextResponse.json({ success: true, data: response.data });

    } catch (error: any) {
        const errMsg = error.response?.data?.message || error.message || 'Unknown error';
        console.error('[SMS Notify] Error:', errMsg);
        return NextResponse.json({ error: errMsg }, { status: 500 });
    }
}
