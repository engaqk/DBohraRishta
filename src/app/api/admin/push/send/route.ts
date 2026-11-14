import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { sendPushNotificationToTokens, sendPushNotificationToUser } from '@/lib/pushNotificationServer';
import * as admin from 'firebase-admin';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
    if (!adminDb) {
        return NextResponse.json({ error: 'Database service unavailable' }, { status: 500 });
    }

    try {
        const body = await req.json();
        const { targetType, targetUserId, testToken, title, body: msgBody, url, customTag } = body;

        if (!title || !msgBody) {
            return NextResponse.json({ error: 'Notification title and message body are required' }, { status: 400 });
        }

        const notificationPayload = {
            title: title.trim(),
            body: msgBody.trim(),
            url: url?.trim() || '/',
            data: {
                tag: customTag?.trim() || 'bohra-rishta-announcement',
                timestamp: Date.now().toString()
            }
        };

        // 1. Single Direct Test to Admin Device
        if (targetType === 'test_token' && testToken) {
            const result = await sendPushNotificationToTokens([testToken], notificationPayload);
            return NextResponse.json({
                success: result.successCount > 0,
                successCount: result.successCount,
                failureCount: result.failureCount,
                message: result.successCount > 0 ? 'Test notification sent directly to your device!' : 'Failed to deliver test notification to this token.'
            });
        }

        // 2. Specific Candidate Targeting
        if (targetType === 'specific' && targetUserId) {
            const result = await sendPushNotificationToUser(targetUserId, notificationPayload);
            return NextResponse.json({
                success: true,
                successCount: result.totalSuccess || 0,
                failureCount: result.totalFailure || 0,
                totalRecipients: 1
            });
        }

        // 3. Audience Broadcast (all, verified, incomplete)
        const usersSnap = await adminDb.collection('users').get();
        const targetTokens = new Set<string>();
        const targetUserIds: string[] = [];
        let matchingUsersCount = 0;

        usersSnap.forEach(doc => {
            const data = doc.data();
            const tokens = Array.isArray(data.fcmTokens) ? data.fcmTokens.filter((t: any) => typeof t === 'string' && t.trim().length > 10) : [];
            if (tokens.length === 0) return;

            const isVerified = data.status === 'verified' || data.status === 'approved';

            let matches = false;
            if (targetType === 'all') matches = true;
            else if (targetType === 'verified' && isVerified) matches = true;
            else if (targetType === 'incomplete' && !isVerified) matches = true;

            if (matches) {
                matchingUsersCount++;
                targetUserIds.push(doc.id);
                tokens.forEach((t: string) => targetTokens.add(t));
            }
        });

        const tokensArray = Array.from(targetTokens);
        if (tokensArray.length === 0) {
            return NextResponse.json({
                success: true,
                successCount: 0,
                failureCount: 0,
                totalRecipients: 0,
                message: 'No active device tokens found for the selected audience.'
            });
        }

        // Also record in-app notifications in batch
        const batch = adminDb.batch();
        let batchCount = 0;
        for (const uid of targetUserIds.slice(0, 500)) {
            const notifRef = adminDb.collection('users').doc(uid).collection('notifications').doc();
            batch.set(notifRef, {
                title: notificationPayload.title,
                body: notificationPayload.body,
                link: notificationPayload.url,
                data: notificationPayload.data,
                unread: true,
                createdAt: admin.firestore.FieldValue.serverTimestamp()
            });
            batchCount++;
            if (batchCount >= 450) break;
        }
        if (batchCount > 0) {
            await batch.commit().catch(e => console.warn('[AdminPushSend] Batch in-app write warning:', e));
        }

        // Dispatch FCM Multicast
        const dispatchResult = await sendPushNotificationToTokens(tokensArray, notificationPayload);

        // Automatically prune stale / unregistered tokens from Firestore so they never linger
        if (dispatchResult.staleTokens && dispatchResult.staleTokens.length > 0) {
            const staleSet = new Set(dispatchResult.staleTokens);
            const batchPrune = adminDb.batch();
            let pruneCount = 0;

            usersSnap.forEach(doc => {
                const data = doc.data();
                if (Array.isArray(data.fcmTokens)) {
                    const toRemove = data.fcmTokens.filter((t: string) => staleSet.has(t));
                    if (toRemove.length > 0) {
                        batchPrune.update(doc.ref, {
                            fcmTokens: admin.firestore.FieldValue.arrayRemove(...toRemove)
                        });
                        pruneCount++;
                    }
                }
            });

            if (pruneCount > 0) {
                await batchPrune.commit().catch(e => console.warn('[AdminPushSend] Stale tokens prune warning:', e));
                console.log(`[AdminPushSend] Automatically pruned ${dispatchResult.staleTokens.length} stale tokens from ${pruneCount} users.`);
            }
        }

        // Record Broadcast in History
        await adminDb.collection('push_broadcast_logs').add({
            title: notificationPayload.title,
            body: notificationPayload.body,
            url: notificationPayload.url,
            targetType,
            totalTokens: tokensArray.length,
            matchingUsersCount,
            successCount: dispatchResult.successCount,
            failureCount: dispatchResult.failureCount,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        }).catch(e => console.warn('[AdminPushSend] History record warning:', e));

        return NextResponse.json({
            success: true,
            successCount: dispatchResult.successCount,
            failureCount: dispatchResult.failureCount,
            totalTokens: tokensArray.length,
            matchingUsersCount
        });
    } catch (err: any) {
        console.error('[AdminPushSend] Error:', err);
        return NextResponse.json({ error: err?.message || 'Failed to dispatch push notification' }, { status: 500 });
    }
}
