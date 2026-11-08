import { NextResponse } from 'next/server';
import { sendPushNotificationToUser, notifyAdmins } from '@/lib/pushNotificationServer';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { targetUserId, notifyAdmin, title, body: msgBody, url, data } = body;

        if (!title || !msgBody) {
            return NextResponse.json({ error: 'Missing title or body' }, { status: 400 });
        }

        if (notifyAdmin) {
            await notifyAdmins({
                title,
                body: msgBody,
                url: url || '/admin/approvals',
                data: data || {}
            });
            return NextResponse.json({ success: true, target: 'admins' });
        }

        if (!targetUserId) {
            return NextResponse.json({ error: 'Missing targetUserId' }, { status: 400 });
        }

        const result = await sendPushNotificationToUser(targetUserId, {
            title,
            body: msgBody,
            url: url || '/',
            data: data || {}
        });

        return NextResponse.json({ success: true, result });
    } catch (err: any) {
        console.error('[PushAPI] Error sending push notification:', err);
        return NextResponse.json({ error: err?.message || 'Failed to dispatch push notification' }, { status: 500 });
    }
}
