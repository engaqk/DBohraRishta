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

        // 1. Execute all queries in parallel for maximum speed
        const [usersSnap, totalRequestsSnap, acceptedRequestsSnap, threadSnap] = await Promise.all([
            // Fetch all users for the pipeline grid
            adminDb.collection('users').get(),
            
            // Efficient counts for stats (doesn't download any documents)
            adminDb.collection('rishta_requests').count().get(),
            adminDb.collection('rishta_requests').where('status', '==', 'accepted').count().get(),
            
            // Scans all thread messages (heavy, but parallelized)
            adminDb.collectionGroup('thread').get()
        ]);

        const users = usersSnap.docs.map(d => ({ uid: d.id, id: d.id, ...d.data() }));
        const totalRequests = totalRequestsSnap.data().count;
        const acceptedRequests = acceptedRequestsSnap.data().count;

        // Process message counts from the parallel snapshot
        let msgCounts: Record<string, { total: number; userMsgs: number }> = {};
        threadSnap.docs.forEach(doc => {
            const parentId = doc.ref.parent.parent?.id;
            if (!parentId) return;
            const data = doc.data();
            if (!msgCounts[parentId]) msgCounts[parentId] = { total: 0, userMsgs: 0 };
            msgCounts[parentId].total++;
            if (data.from === 'user' && data.readByAdmin !== true) msgCounts[parentId].userMsgs++;
        });

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
