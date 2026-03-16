import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const authHeader = request.headers.get('Authorization');
        if (authHeader !== 'secure_admin_session_active') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (!adminDb) {
            return NextResponse.json({ error: 'Admin DB not configured' }, { status: 503 });
        }

        const snap = await adminDb
            .collection('sms_broadcasts')
            .orderBy('createdAt', 'desc')
            .limit(20)
            .get();

        const history = snap.docs.map(d => {
            const data = d.data();
            return {
                id: d.id,
                ...data,
                createdAt: data.createdAt?.toDate?.() || data.createdAt
            };
        });

        return NextResponse.json({ history });

    } catch (error: any) {
        console.error('[sms-history] GET Error:', error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
