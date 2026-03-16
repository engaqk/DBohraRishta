import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

export const dynamic = 'force-dynamic';

/**
 * Textbee Webhook — receives real-time SMS delivery status updates.
 *
 * Configured in Textbee Dashboard → Webhooks:
 *   Delivery URL:  https://www.53dbohrarishta.in/api/webhooks/textbee
 *   Signing Secret: stored in TEXTBEE_WEBHOOK_SECRET env var
 *   Events: MESSAGE_SENT, MESSAGE_DELIVERED, MESSAGE_FAILED
 *
 * Textbee signs each request with a header: x-textbee-signature
 * Format: HMAC-SHA256 of the raw request body using the signing secret.
 */

async function verifySignature(req: Request, rawBody: string): Promise<boolean> {
    const secret = process.env.TEXTBEE_WEBHOOK_SECRET;
    if (!secret) return true; // Skip verification if secret not configured

    const signature = req.headers.get('x-textbee-signature') ||
        req.headers.get('x-webhook-signature') ||
        req.headers.get('x-signature');

    if (!signature) {
        console.warn('[Textbee Webhook] No signature header found — proceeding without verification');
        return true; // Accept without signature (Textbee may not always send one)
    }

    try {
        const encoder = new TextEncoder();
        const key = await crypto.subtle.importKey(
            'raw',
            encoder.encode(secret),
            { name: 'HMAC', hash: 'SHA-256' },
            false,
            ['sign']
        );
        const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(rawBody));
        const expectedSig = Array.from(new Uint8Array(sig))
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');

        return signature === expectedSig || signature === `sha256=${expectedSig}`;
    } catch {
        return true; // On crypto error, proceed
    }
}

export async function POST(req: Request) {
    try {
        const rawBody = await req.text();
        const body = JSON.parse(rawBody);

        // Verify the request is genuinely from Textbee
        const isValid = await verifySignature(req, rawBody);
        if (!isValid) {
            console.warn('[Textbee Webhook] Signature mismatch — rejected');
            return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
        }

        console.log('[Textbee Webhook] Event received:', body.event, '| Receiver:', body.data?.receiver);

        const event = (body.event || '').toUpperCase();
        const data = body.data || body;

        // Normalize event + status
        const receiver: string = data.receiver || data.recipient || data.to || '';
        const textbeeId: string = data.id || data.messageId || data._id || '';
        const status: string = data.status?.toUpperCase() ||
            (event.includes('DELIVERED') ? 'DELIVERED' :
                event.includes('FAILED') ? 'FAILED' :
                    event.includes('SENT') ? 'SENT' : 'UNKNOWN');

        const isDelivered = status === 'DELIVERED';
        const isFailed = status === 'FAILED';

        if (adminDb && (receiver || textbeeId)) {
            // 1. Log to sms_logs collection for audit
            try {
                const logEntry: Record<string, any> = {
                    event,
                    receiver: receiver || null,
                    textbeeId: textbeeId || null,
                    status,
                    errorCode: data.errorCode || null,
                    errorMessage: data.errorMessage || null,
                    sentAt: data.sentAt || null,
                    deliveredAt: data.deliveredAt || null,
                    receivedAt: new Date().toISOString(),
                    source: 'webhook',
                };

                // Try to update existing log first
                if (textbeeId) {
                    const existing = await adminDb.collection('sms_logs')
                        .where('textbeeId', '==', textbeeId)
                        .limit(1)
                        .get();

                    if (!existing.empty) {
                        await existing.docs[0].ref.update({ status, ...logEntry });
                    } else {
                        await adminDb.collection('sms_logs').add(logEntry);
                    }
                } else {
                    await adminDb.collection('sms_logs').add(logEntry);
                }
            } catch (logErr: any) {
                console.warn('[Textbee Webhook] sms_logs error:', logErr.message);
            }

            // 2. Update broadcast delivery stats
            if (receiver && (isDelivered || isFailed)) {
                try {
                    const broadcastsRef = adminDb.collection('sms_broadcasts');
                    const recentBroadcasts = await broadcastsRef
                        .orderBy('sentAt', 'desc')
                        .limit(10)
                        .get();

                    for (const broadcastDoc of recentBroadcasts.docs) {
                        const bd = broadcastDoc.data();
                        const recipients: string[] = bd.recipients || [];

                        if (recipients.includes(receiver)) {
                            const update: Record<string, any> = { updatedAt: new Date().toISOString() };

                            if (isDelivered) {
                                const delivered: string[] = bd.deliveredNumbers || [];
                                if (!delivered.includes(receiver)) {
                                    update.deliveredNumbers = [...delivered, receiver];
                                }
                            } else if (isFailed) {
                                const failed: string[] = bd.failedNumbers || [];
                                if (!failed.includes(receiver)) {
                                    update.failedNumbers = [...failed, receiver];
                                    update.failedDetails = [
                                        ...(bd.failedDetails || []),
                                        { receiver, errorCode: data.errorCode, errorMessage: data.errorMessage }
                                    ];
                                }
                            }

                            await broadcastDoc.ref.update(update);
                            break;
                        }
                    }
                } catch (broadcastErr: any) {
                    console.warn('[Textbee Webhook] broadcast update error:', broadcastErr.message);
                }
            }
        }

        console.log(`[Textbee Webhook] ✅ Processed: ${status} for ${receiver || textbeeId}`);
        return NextResponse.json({ received: true, status });

    } catch (error: any) {
        console.error('[Textbee Webhook] Parse error:', error.message);
        // Always return 200 to prevent Textbee retry storms
        return NextResponse.json({ received: true, warning: 'Parse error: ' + error.message });
    }
}

// GET — lets Textbee verify the endpoint is reachable
export async function GET() {
    return NextResponse.json({
        status: 'active',
        endpoint: 'Textbee webhook for 53DBohraRishta',
        events: ['MESSAGE_SENT', 'MESSAGE_DELIVERED', 'MESSAGE_FAILED'],
    });
}
