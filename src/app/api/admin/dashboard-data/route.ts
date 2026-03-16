import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

export const dynamic = 'force-dynamic';

/**
 * Admin dashboard data endpoint.
 * Uses Firebase Admin SDK (adminDb) — bypasses Firestore security rules entirely.
 * The admin auth guard is the Authorization header check below.
 */
export async function GET(request: Request) {
    try {
        const authHeader = request.headers.get('Authorization');
        if (authHeader !== 'secure_admin_session_active') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (!adminDb) {
            return NextResponse.json({ error: 'Admin DB not configured' }, { status: 503 });
        }

        // 1. Fetch all users
        const usersSnap = await adminDb.collection('users').get();
        const users = usersSnap.docs.map(d => ({ uid: d.id, id: d.id, ...d.data() }));

        // 2. Fetch rishta_requests stats
        const requestsSnap = await adminDb.collection('rishta_requests').get();
        const totalRequests = requestsSnap.size;
        const acceptedRequests = requestsSnap.docs.filter(d => d.data().status === 'accepted').length;

        // 3. Fetch all thread messages for unread counts
        // collectionGroup equivalent via admin SDK
        let msgCounts: Record<string, { total: number; userMsgs: number }> = {};
        try {
            const threadSnap = await adminDb.collectionGroup('thread').get();
            threadSnap.docs.forEach(doc => {
                const parentId = doc.ref.parent.parent?.id;
                if (!parentId) return;
                const data = doc.data();
                if (!msgCounts[parentId]) msgCounts[parentId] = { total: 0, userMsgs: 0 };
                msgCounts[parentId].total++;
                if (data.from === 'user' && data.readByAdmin !== true) msgCounts[parentId].userMsgs++;
            });
        } catch (threadErr: any) {
            console.warn('[dashboard-data] Thread query failed:', threadErr.message);
        }

        return NextResponse.json({
            users,
            requestStats: { total: totalRequests, accepted: acceptedRequests },
            msgCounts,
            fetchedAt: new Date().toISOString(),
        });

    } catch (error: any) {
        console.error('[dashboard-data] Error:', error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
