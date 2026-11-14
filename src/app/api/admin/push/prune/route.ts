import { NextResponse } from 'next/server';
import { adminDb, adminMessaging } from '@/lib/firebase/admin';
import * as admin from 'firebase-admin';

export const dynamic = 'force-dynamic';

export async function POST() {
    if (!adminDb || !adminMessaging) {
        return NextResponse.json({ error: 'Push service unavailable' }, { status: 500 });
    }

    try {
        const usersSnap = await adminDb.collection('users').get();
        const allTokens: string[] = [];

        usersSnap.forEach(doc => {
            const data = doc.data();
            if (Array.isArray(data.fcmTokens)) {
                data.fcmTokens.forEach((t: any) => {
                    if (typeof t === 'string' && t.trim().length > 10) {
                        allTokens.push(t);
                    }
                });
            }
        });

        const uniqueTokens = Array.from(new Set(allTokens));
        if (uniqueTokens.length === 0) {
            return NextResponse.json({
                success: true,
                message: 'No tokens found in database.',
                prunedCount: 0,
                activeCount: 0
            });
        }

        // Test with lightweight health check multicast in dryRun mode (validates without ringing user devices)
        const payload = {
            tokens: uniqueTokens,
            notification: {
                title: 'Health Check',
                body: 'Verifying active device status'
            }
        };

        const res = await adminMessaging.sendEachForMulticast(payload, true);
        const staleTokens = new Set<string>();
        let activeCount = 0;

        res.responses.forEach((resp, idx) => {
            const tok = uniqueTokens[idx];
            if (resp.success) {
                activeCount++;
            } else {
                const errCode = resp.error?.code || '';
                if (
                    errCode === 'messaging/invalid-registration-token' ||
                    errCode === 'messaging/registration-token-not-registered' ||
                    errCode === 'messaging/invalid-argument' ||
                    errCode.includes('token') ||
                    errCode.includes('registered')
                ) {
                    staleTokens.add(tok);
                }
            }
        });

        let updatedUsers = 0;
        if (staleTokens.size > 0) {
            const batch = adminDb.batch();

            usersSnap.forEach(doc => {
                const data = doc.data();
                if (Array.isArray(data.fcmTokens)) {
                    const toRemove = data.fcmTokens.filter((t: string) => staleTokens.has(t));
                    if (toRemove.length > 0) {
                        batch.update(doc.ref, {
                            fcmTokens: admin.firestore.FieldValue.arrayRemove(...toRemove)
                        });
                        updatedUsers++;
                    }
                }
            });

            if (updatedUsers > 0) {
                await batch.commit();
            }
        }

        return NextResponse.json({
            success: true,
            activeCount,
            prunedCount: staleTokens.size,
            updatedUsers,
            message: `Cleaned ${staleTokens.size} stale device tokens across ${updatedUsers} user profiles. ${activeCount} active devices verified.`
        });
    } catch (err: any) {
        console.error('[AdminPushPrune] Error:', err);
        return NextResponse.json({ error: err?.message || 'Failed to prune tokens' }, { status: 500 });
    }
}
