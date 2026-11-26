import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import * as admin from 'firebase-admin';

export const dynamic = 'force-dynamic';

/**
 * GET /api/bookmarks/mutual?userId=<uid>
 * Returns only the intersection of users who bookmarked each other.
 * Never exposes one-way bookmarks.
 */
export async function GET(req: Request) {
    try {
        if (!adminDb) {
            return NextResponse.json({ mutualProfileIds: [] });
        }

        const { searchParams } = new URL(req.url);
        const userId = searchParams.get('userId');

        if (!userId) {
            return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
        }

        const [myBookmarksSnap, bookmarkedMeSnap] = await Promise.all([
            adminDb.collection('bookmarks').where('userId', '==', userId).get(),
            adminDb.collection('bookmarks').where('profileId', '==', userId).get(),
        ]);

        const iBookmarked = new Set<string>();
        myBookmarksSnap.forEach((doc) => {
            const pid = doc.data()?.profileId;
            if (pid) iBookmarked.add(pid);
        });

        const mutualProfileIds: string[] = [];
        bookmarkedMeSnap.forEach((doc) => {
            const uid = doc.data()?.userId;
            if (uid && iBookmarked.has(uid) && !mutualProfileIds.includes(uid)) {
                mutualProfileIds.push(uid);
            }
        });

        return NextResponse.json({ mutualProfileIds });
    } catch (err: any) {
        console.error('Error fetching mutual bookmarks:', err);
        return NextResponse.json({ mutualProfileIds: [] });
    }
}

/**
 * POST /api/bookmarks/mutual
 * Checks if targetProfileId has also bookmarked userId.
 * If mutual, sends a celebratory in-app notification to targetProfileId.
 */
export async function POST(req: Request) {
    try {
        if (!adminDb) {
            return NextResponse.json({ isMutual: false });
        }

        const body = await req.json();
        const { userId, targetProfileId, userName } = body;

        if (!userId || !targetProfileId) {
            return NextResponse.json({ error: 'Missing userId or targetProfileId' }, { status: 400 });
        }

        // Check if targetProfileId already bookmarked userId
        const reverseSnap = await adminDb
            .collection('bookmarks')
            .where('userId', '==', targetProfileId)
            .where('profileId', '==', userId)
            .limit(1)
            .get();

        if (reverseSnap.empty) {
            return NextResponse.json({ isMutual: false });
        }

        // It's a mutual bookmark! Send a joyful notification to the other user
        // Avoid spamming if a mutual_bookmark notification for this user already exists
        try {
            const existingNotifSnap = await adminDb
                .collection(`users/${targetProfileId}/notifications`)
                .where('type', '==', 'mutual_bookmark')
                .where('fromUserId', '==', userId)
                .limit(1)
                .get();

            if (existingNotifSnap.empty) {
                const senderLabel = userName ? userName.split(' ')[0] : 'A verified candidate';
                await adminDb.collection(`users/${targetProfileId}/notifications`).add({
                    type: 'mutual_bookmark',
                    fromUserId: userId,
                    title: '✨ Mutual Bookmark Spark!',
                    message: `Alhamdulillah! Both you and ${senderLabel} saved each other's profiles. Say Salam now!`,
                    read: false,
                    createdAt: admin.firestore.FieldValue.serverTimestamp(),
                });
            }
        } catch (notifErr) {
            console.warn('Mutual bookmark notification notice:', notifErr);
        }

        return NextResponse.json({ isMutual: true, targetProfileId });
    } catch (err: any) {
        console.error('Error checking mutual bookmark:', err);
        return NextResponse.json({ isMutual: false });
    }
}
