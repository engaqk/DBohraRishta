import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

export const dynamic = 'force-dynamic';

export async function GET() {
    if (!adminDb) {
        return NextResponse.json({ error: 'Database service unavailable' }, { status: 500 });
    }

    try {
        const snap = await adminDb
            .collection('push_broadcast_logs')
            .orderBy('createdAt', 'desc')
            .limit(30)
            .get();

        const history: any[] = [];
        snap.forEach(doc => {
            const data = doc.data();
            history.push({
                id: doc.id,
                ...data,
                createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : new Date().toISOString()
            });
        });

        return NextResponse.json({ success: true, history });
    } catch (err: any) {
        console.error('[AdminPushHistory] Error:', err);
        return NextResponse.json({ error: err?.message || 'Failed to fetch history' }, { status: 500 });
    }
}
