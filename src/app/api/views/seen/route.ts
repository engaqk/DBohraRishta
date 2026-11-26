import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

export const dynamic = 'force-dynamic';

/**
 * GET /api/views/seen?userId=<uid>
 * Returns the list of profile IDs that userId has already viewed.
 */
export async function GET(req: Request) {
    try {
        if (!adminDb) {
            return NextResponse.json({ seenProfileIds: [] });
        }

        const { searchParams } = new URL(req.url);
        const userId = searchParams.get('userId');

        if (!userId) {
            return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
        }

        const snap = await adminDb
            .collection('profile_views')
            .where('viewerId', '==', userId)
            .select('profileId')
            .get();

        const seenSet = new Set<string>();
        snap.forEach((doc) => {
            const pid = doc.data()?.profileId;
            if (pid) seenSet.add(pid);
        });

        return NextResponse.json({ seenProfileIds: Array.from(seenSet) });
    } catch (err: any) {
        console.error('Error fetching seen profiles:', err);
        return NextResponse.json({ seenProfileIds: [] });
    }
}
