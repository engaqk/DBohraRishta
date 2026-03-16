import { NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebase/admin';

export const dynamic = 'force-dynamic';

function normalizePhone(raw: string): string | null {
    if (!raw) return null;
    let phone = raw.replace(/[\s\-()]/g, '');
    if (phone.startsWith('00')) phone = '+' + phone.substring(2);
    if (!phone.startsWith('+') && /^\d{10,15}$/.test(phone)) phone = '+' + phone;
    return /^\+\d{10,15}$/.test(phone) ? phone : null;
}

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

        // ── 2. Fetch from Firebase Auth (for users with no biodata yet) ────────
        if (adminAuth && typeof adminAuth.listUsers === 'function') {
            let pageToken: string | undefined;
            do {
                const result = await adminAuth.listUsers(1000, pageToken);
                result.users.forEach(u => {
                    // Mobile-registered users convention (+919876543210@dbohrarishta.local)
                    if (u.email?.endsWith('@dbohrarishta.local')) {
                        const phone = normalizePhone(u.email.replace('@dbohrarishta.local', ''));
                        if (phone) phoneSet.add(phone);
                    }
                    // Standard Firebase phone field
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

        console.log(`SMS Broadcast: Sending to ${totalFound} unique mobile numbers.`);

        const textbeeUrl = `https://api.textbee.dev/api/v1/gateway/devices/${deviceId}/send-sms`;
        const { default: axios } = await import('axios');

        const chunkSize = 100;
        let successCount = 0;
        let failCount = 0;

        for (let i = 0; i < phones.length; i += chunkSize) {
            const chunk = phones.slice(i, i + chunkSize);
            try {
                await axios.post(
                    textbeeUrl,
                    {
                        recipients: chunk,
                        smsBody: message.trim(),
                    },
                    {
                        headers: {
                            'x-api-key': apiKey,
                            'Content-Type': 'application/json',
                        },
                        timeout: 35000,
                    }
                );
                successCount += chunk.length;
            } catch (err: any) {
                failCount += chunk.length;
                console.error(`SMS chunk failed:`, err?.response?.data || err.message);
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
            message: `SMS broadcast dispatched to ${successCount} numbers.`,
        });

    } catch (error: any) {
        console.error('SMS Broadcast Error:', error);
        return NextResponse.json(
            { error: error.message || 'Unknown server error' },
            { status: 500 }
        );
    }
}
