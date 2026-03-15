import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin-config';
import * as admin from 'firebase-admin';

export const dynamic = 'force-dynamic';

/**
 * Admin API for managing user message threads.
 */
export async function GET(request: Request) {
    try {
        const authHeader = request.headers.get('Authorization');
        if (authHeader !== 'secure_admin_session_active') {
             return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const userId = searchParams.get('userId');

        if (!userId) {
            return NextResponse.json({ error: 'userId is required' }, { status: 400 });
        }

        if (!adminDb) {
            return NextResponse.json({ error: 'Admin DB not configured' }, { status: 503 });
        }

        const msgSnap = await adminDb
            .collection('admin_messages')
            .doc(userId)
            .collection('thread')
            .orderBy('createdAt', 'asc')
            .get();

        const messages = msgSnap.docs.map(d => {
            const data = d.data();
            return {
                id: d.id,
                ...data,
                createdAt: data.createdAt?.toDate?.() || data.createdAt
            };
        });

        return NextResponse.json({ messages });

    } catch (error: any) {
        console.error('[user-messages] GET Error:', error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const authHeader = request.headers.get('Authorization');
        if (authHeader !== 'secure_admin_session_active') {
             return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { userId, text, from = 'admin' } = body;

        if (!userId || !text) {
            return NextResponse.json({ error: 'userId and text are required' }, { status: 400 });
        }

        if (!adminDb) {
            return NextResponse.json({ error: 'Admin DB not configured' }, { status: 503 });
        }

        // 1. Add message to thread
        await adminDb
            .collection('admin_messages')
            .doc(userId)
            .collection('thread')
            .add({
                text,
                from,
                createdAt: admin.firestore.FieldValue.serverTimestamp()
            });

        // 2. Update user document with admin message and flag
        if (from === 'admin') {
            await adminDb.collection('users').doc(userId).update({
                adminMessage: text,
                hasUnreadAdminMessage: true,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
        }

        return NextResponse.json({ success: true });

    } catch (error: any) {
        console.error('[user-messages] POST Error:', error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
