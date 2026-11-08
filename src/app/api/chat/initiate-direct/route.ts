import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import * as admin from 'firebase-admin';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
    try {
        if (!adminDb) {
            return NextResponse.json({ error: 'Database service unavailable' }, { status: 503 });
        }

        const body = await req.json();
        const { currentUserId, targetUserId } = body;

        if (!currentUserId || !targetUserId) {
            return NextResponse.json({ error: 'Missing currentUserId or targetUserId' }, { status: 400 });
        }

        const sortedIds = [currentUserId, targetUserId].sort();
        const roomId = `direct_${sortedIds.join('_')}`;

        const roomRef = adminDb.collection('rishta_requests').doc(roomId);
        const snap = await roomRef.get();

        if (!snap.exists) {
            await roomRef.set({
                from: currentUserId,
                to: targetUserId,
                participants: [currentUserId, targetUserId],
                status: 'open_chat',
                isOpenChat: true,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                initiator: currentUserId
            });
        } else {
            // Room exists, ensure isOpenChat is true
            await roomRef.set({
                isOpenChat: true,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
        }

        return NextResponse.json({
            success: true,
            roomId,
            id: roomId
        });
    } catch (err: any) {
        console.error('Error in initiate-direct API:', err);
        return NextResponse.json({ error: err?.message || 'Failed to initiate room' }, { status: 500 });
    }
}
