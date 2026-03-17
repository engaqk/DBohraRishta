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
        // Removed collectionGroup('thread') scan which was causing major slowdowns
        const [usersSnap, totalRequestsSnap, acceptedRequestsSnap] = await Promise.all([
            // Fetch users with only essential fields for the dashboard
            adminDb.collection('users')
                .select(
                    'name', 'itsNumber', 'ejamaatId', 'gender', 'maritalStatus', 'status', 
                    'hizratLocation', 'city', 'country', 'education', 'educationDetails',
                    'profession', 'professionType', 'mobile', 'mobileCode', 'email',
                    'adminMessage', 'isItsVerified', 'isCandidateFormComplete', 'createdAt',
                    'unreadMsgCountForAdmin', 'totalMsgCount', 'dob', 'fatherName', 'motherName',
                    'libasImageUrl', 'itsImageUrl'
                ).get(),
            
            // Efficient counts for stats (doesn't download any documents)
            adminDb.collection('rishta_requests').count().get(),
            adminDb.collection('rishta_requests').where('status', '==', 'accepted').count().get(),
        ]);

        const totalRequests = totalRequestsSnap.data().count;
        const acceptedRequests = acceptedRequestsSnap.data().count;

        let msgCounts: Record<string, { total: number; userMsgs: number }> = {};
        
        const users = usersSnap.docs.map(d => {
            const data = d.data();
            const uid = d.id;
            
            // Use the pre-calculated counts from the user document
            msgCounts[uid] = { 
                total: data.totalMsgCount || 0, 
                userMsgs: data.unreadMsgCountForAdmin || 0 
            };

            return { uid, id: uid, ...data };
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
