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

        const { sendSMS } = await import('@/lib/smsService');
        const result = await sendSMS(rawPhone, message);

        if (result.success) {
            console.log('[SMS Notify] SUCCESS:', result.data);
            return NextResponse.json({ success: true, data: result.data });
        } else {
            console.error('[SMS Notify] FAILED:', result.error);
            return NextResponse.json({ error: result.error }, { status: 500 });
        }
    } catch (error: any) {
        console.error('[SMS Notify] POST Error:', error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
