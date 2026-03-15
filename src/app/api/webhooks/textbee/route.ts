import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin-config';

export const dynamic = 'force-dynamic';

/**
 * Textbee Webhook — receives real-time SMS delivery status updates.
 * 
 * Register this URL in Textbee Dashboard → Webhooks:
 *   https://www.53dbohrarishta.in/api/webhooks/textbee
 *
 * Textbee sends a POST with JSON payload like:
 * {
 *   "event": "sms.status.updated",
 *   "data": {
 *     "id": "<sms-id>",
 *     "receiver": "+919876543210",
 *     "status": "DELIVERED" | "FAILED" | "SENT" | "PENDING",
 *     "errorCode": 17,        // present if status=FAILED
 *     "errorMessage": "...",  // present if status=FAILED
 *     "sentAt": "2026-...",
 *     "deliveredAt": "2026-..."
 *   }
 * }
 */
export async function POST(req: Request) {
    try {
        const body = await req.json();
        console.log('[Textbee Webhook] Received:', JSON.stringify(body));

        const event = body.event;
        const data = body.data;

        if (!event || !data) {
            return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
        }

        // Handle SMS status updates
        if (event === 'sms.status.updated' || event === 'sms.sent' || event === 'sms.failed') {
            const { id, receiver, status, errorCode, errorMessage, sentAt, deliveredAt } = data;

            const statusUpper = (status || '').toUpperCase();
            const isDelivered = statusUpper === 'DELIVERED';
            const isFailed = statusUpper === 'FAILED';

            if (adminDb) {
                // 1. Try to find matching entry in sms_logs (individual message tracking)
                try {
                    const logsRef = adminDb.collection('sms_logs');
                    const existing = await logsRef
                        .where('textbeeId', '==', id)
                        .limit(1)
                        .get();

                    if (!existing.empty) {
                        await existing.docs[0].ref.update({
                            status: statusUpper,
                            deliveredAt: deliveredAt || null,
                            errorCode: errorCode || null,
                            errorMessage: errorMessage || null,
                            updatedAt: new Date().toISOString(),
                        });
                    } else {
                        // Create a new log entry if it doesn't exist yet
                        await logsRef.add({
                            textbeeId: id,
                            receiver: receiver || null,
                            status: statusUpper,
                            sentAt: sentAt || new Date().toISOString(),
                            deliveredAt: deliveredAt || null,
                            errorCode: errorCode || null,
                            errorMessage: errorMessage || null,
                            updatedAt: new Date().toISOString(),
                            source: 'webhook',
                        });
                    }
                } catch (dbError: any) {
                    console.warn('[Textbee Webhook] sms_logs update failed:', dbError.message);
                }

                // 2. Also update sms_broadcasts entries that contain this receiver number
                if (receiver && isFailed) {
                    try {
                        const broadcastsRef = adminDb.collection('sms_broadcasts');
                        const recentBroadcasts = await broadcastsRef
                            .orderBy('sentAt', 'desc')
                            .limit(5)
                            .get();

                        for (const broadcastDoc of recentBroadcasts.docs) {
                            const broadcastData = broadcastDoc.data();
                            const failed: string[] = broadcastData.failedNumbers || [];
                            const delivered: string[] = broadcastData.deliveredNumbers || [];

                            if (broadcastData.recipients?.includes(receiver) && !failed.includes(receiver)) {
                                await broadcastDoc.ref.update({
                                    failedNumbers: [...failed, receiver],
                                    deliveredNumbers: delivered.filter((n: string) => n !== receiver),
                                    updatedAt: new Date().toISOString(),
                                });
                                break;
                            }
                        }
                    } catch (bErr: any) {
                        console.warn('[Textbee Webhook] broadcast update failed:', bErr.message);
                    }
                }

                if (receiver && isDelivered) {
                    try {
                        const broadcastsRef = adminDb.collection('sms_broadcasts');
                        const recentBroadcasts = await broadcastsRef
                            .orderBy('sentAt', 'desc')
                            .limit(5)
                            .get();

                        for (const broadcastDoc of recentBroadcasts.docs) {
                            const broadcastData = broadcastDoc.data();
                            const delivered: string[] = broadcastData.deliveredNumbers || [];

                            if (broadcastData.recipients?.includes(receiver) && !delivered.includes(receiver)) {
                                await broadcastDoc.ref.update({
                                    deliveredNumbers: [...delivered, receiver],
                                    updatedAt: new Date().toISOString(),
                                });
                                break;
                            }
                        }
                    } catch (bErr: any) {
                        console.warn('[Textbee Webhook] broadcast delivered update failed:', bErr.message);
                    }
                }
            }

            console.log(`[Textbee Webhook] SMS ${id} to ${receiver}: ${statusUpper}${errorCode ? ` (Error ${errorCode}: ${errorMessage})` : ''}`);
        }

        return NextResponse.json({ received: true });

    } catch (error: any) {
        console.error('[Textbee Webhook] Error:', error.message);
        // Always return 200 to Textbee — otherwise it will keep retrying
        return NextResponse.json({ received: true, warning: error.message });
    }
}

// Textbee may also send GET to verify the endpoint
export async function GET() {
    return NextResponse.json({ status: 'Textbee webhook endpoint active', app: '53DBohraRishta' });
}
