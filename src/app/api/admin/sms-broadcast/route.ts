import { NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebase/admin';
import { normalizePhone } from '@/lib/phoneUtils';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
    if (!adminDb || typeof adminDb.collection !== 'function') {
        return NextResponse.json(
            { error: 'Firebase Admin DB not configured. Cannot send SMS broadcasts.' },
            { status: 503 }
        );
    }

    const deviceId = process.env.TEXTBEE_DEVICE_ID;
    const apiKey = process.env.TEXTBEE_API_KEY;

    if (!deviceId || !apiKey) {
        return NextResponse.json(
            { error: 'Textbee SMS credentials are not configured on the server.' },
            { status: 503 }
        );
    }

    try {
        const body = await req.json();
        const { message, adminId } = body;

        if (!message || !message.trim()) {
            return NextResponse.json({ error: 'Message body is required.' }, { status: 400 });
        }

        const phoneSet = new Set<string>();

        // ── 1. Fetch from Firestore users collection ──────────────────────────
        const usersSnapshot = await adminDb.collection('users').get();
        usersSnapshot.docs.forEach(d => {
            const data = d.data();
            const raw = data['mobile'] || data['mobileNumber'];
            const phone = normalizePhone(raw);
            if (phone) phoneSet.add(phone);
        });

        // ── 2. Fetch from Firebase Auth ───────────────────────────────────────
        if (adminAuth && typeof adminAuth.listUsers === 'function') {
            let pageToken: string | undefined;
            do {
                const result = await adminAuth.listUsers(1000, pageToken);
                result.users.forEach(u => {
                    if (u.email?.endsWith('@dbohrarishta.local')) {
                        const phone = normalizePhone(u.email.replace('@dbohrarishta.local', ''));
                        if (phone) phoneSet.add(phone);
                    }
                    if (u.phoneNumber) {
                        const phone = normalizePhone(u.phoneNumber);
                        if (phone) phoneSet.add(phone);
                    }
                });
                pageToken = result.pageToken;
            } while (pageToken);
        }

        const phones = Array.from(phoneSet);
        const totalFound = phones.length;

        if (totalFound === 0) {
            return NextResponse.json({
                success: false,
                error: 'No valid mobile numbers found in Database or Auth.',
                totalFound: 0,
                sent: 0,
                failed: 0
            });
        }

        console.log(`SMS Broadcast: Sending to ${totalFound} unique numbers using Bulk API.`);

        const textbeeUrl = `https://api.textbee.dev/api/v1/gateway/devices/${deviceId}/send-bulk-sms`;
        const { default: axios } = await import('axios');

        const chunkSize = 200; 
        let successCount = 0;
        let failCount = 0;
        let batchIds: string[] = [];

        for (let i = 0; i < phones.length; i += chunkSize) {
            const chunk = phones.slice(i, i + chunkSize);
            try {
                const response = await axios.post(
                    textbeeUrl,
                    {
                        messages: [
                            {
                                message: message.trim(),
                                recipients: chunk,
                            }
                        ]
                    },
                    {
                        headers: {
                            'x-api-key': apiKey,
                            'Content-Type': 'application/json',
                        },
                        timeout: 45000,
                    }
                );
                
                const bId = response.data?.data?._id || response.data?.data?.batchId;
                if (bId) batchIds.push(bId);
                
                successCount += chunk.length;
            } catch (err: any) {
                failCount += chunk.length;
                console.error(`SMS bulk chunk failed:`, err?.response?.data || err.message);
            }
        }

        // Log action in audit trail
        try {
            await adminDb.collection('sms_broadcasts').add({
                message: message.trim(),
                adminId: adminId || 'admin',
                totalFound,
                sent: successCount,
                failed: failCount,
                batchId: batchIds[0] || null,
                batchIds,
                createdAt: new Date(),
            });
        } catch (logErr) {
            console.warn('Failed to log SMS broadcast:', logErr);
        }

        return NextResponse.json({
            success: true,
            totalFound,
            sent: successCount,
            failed: failCount,
            batchId: batchIds[0] || null,
            message: `SMS broadcast dispatched. Delivered: ${successCount}. Batch ID: ${batchIds[0] || 'N/A'}`,
        });

    } catch (error: any) {
        console.error('SMS Broadcast Error:', error);
        return NextResponse.json(
            { error: error.message || 'Unknown server error' },
            { status: 500 }
        );
    }
}
