import { NextResponse } from 'next/server';
import axios from 'axios';

export const dynamic = 'force-dynamic';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ batchId: string }> }
) {
    try {
        const { batchId } = await params;
        const authHeader = request.headers.get('Authorization');
        if (authHeader !== 'secure_admin_session_active') {
             return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const deviceId = process.env.TEXTBEE_DEVICE_ID;
        const apiKey = process.env.TEXTBEE_API_KEY;

        if (!deviceId || !apiKey) {
            return NextResponse.json({ error: 'Textbee credentials missing' }, { status: 503 });
        }

        const url = `https://api.textbee.dev/api/v1/gateway/devices/${deviceId}/sms-batch/${batchId}`;
        const response = await axios.get(url, {
            headers: { 'x-api-key': apiKey }
        });

        return NextResponse.json(response.data);

    } catch (error: any) {
        console.error('[sms-batch] Error:', error.response?.data || error.message);
        return NextResponse.json(
            { error: error.response?.data?.message || 'Failed to fetch batch status' },
            { status: error.response?.status || 500 }
        );
    }
}
