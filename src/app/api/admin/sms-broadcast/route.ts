import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin-config';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
    if (!adminDb) {
        return NextResponse.json(
            { error: 'Firebase Admin not configured. Cannot send SMS broadcasts.' },
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

        // Fetch all users from Firestore
        const usersSnapshot = await adminDb.collection('users').get();
        const allUsers: Record<string, any>[] = usersSnapshot.docs.map(d => ({
            id: d.id,
            ...(d.data() as Record<string, any>),
        }));

        // Collect unique, valid mobile numbers
        const phoneSet = new Set<string>();
        allUsers.forEach((u: Record<string, any>) => {
            const mobile: string | undefined = u['mobile'] || u['mobileNumber'];
            if (mobile && typeof mobile === 'string') {
                const cleaned = mobile.replace(/[\s\-()]/g, '');
                // Basic validation: must start with + and have 10-15 digits
                if (/^\+\d{10,15}$/.test(cleaned)) {
                    phoneSet.add(cleaned);
                }
            }
        });

        const phones = Array.from(phoneSet);
        const totalFound = phones.length;

        if (totalFound === 0) {
            return NextResponse.json({
                success: false,
                error: 'No valid mobile numbers found in the database.',
                totalFound: 0,
                sent: 0,
                failed: 0
            });
        }

        console.log(`SMS Broadcast: Sending to ${totalFound} mobile numbers.`);

        const textbeeUrl = `https://api.textbee.dev/api/v1/gateway/devices/${deviceId}/send-sms`;
        const { default: axios } = await import('axios');

        // Textbee supports batch sending — send all at once (up to provider limits)
        // For safety we chunk into groups of 100
        const chunkSize = 100;
        let successCount = 0;
        let failCount = 0;

        for (let i = 0; i < phones.length; i += chunkSize) {
            const chunk = phones.slice(i, i + chunkSize);

            try {
                await axios.post(
                    textbeeUrl,
                    {
                        receivers: chunk,
                        smsBody: message.trim(),
                    },
                    {
                        headers: {
                            'x-api-key': apiKey,
                            'Content-Type': 'application/json',
                        },
                        timeout: 30000,
                    }
                );
                successCount += chunk.length;
                console.log(`SMS chunk ${Math.ceil(i / chunkSize) + 1} sent to ${chunk.length} numbers.`);
            } catch (err: any) {
                failCount += chunk.length;
                console.error(`SMS chunk failed:`, err?.response?.data || err.message);
            }
        }

        // Log in Firestore for audit trail
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
            console.warn('Failed to log SMS broadcast to Firestore:', logErr);
        }

        return NextResponse.json({
            success: true,
            totalFound,
            sent: successCount,
            failed: failCount,
            message: `SMS broadcast dispatched to ${successCount} of ${totalFound} numbers.`,
        });

    } catch (error: any) {
        console.error('SMS Broadcast Error:', error);
        return NextResponse.json(
            { error: error.message || 'Unknown server error' },
            { status: 500 }
        );
    }
}
