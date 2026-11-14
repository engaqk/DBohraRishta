import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
    if (!adminDb) {
        return NextResponse.json({ error: 'Database service unavailable' }, { status: 500 });
    }

    try {
        const usersSnap = await adminDb.collection('users').get();
        let totalUsers = usersSnap.size;
        let usersWithTokensCount = 0;
        let totalTokensCount = 0;
        let verifiedWithTokensCount = 0;
        let incompleteWithTokensCount = 0;

        const candidateList: Array<{
            id: string;
            name: string;
            email: string;
            itsNumber: string;
            gender: string;
            status: string;
            tokensCount: number;
        }> = [];

        usersSnap.forEach(doc => {
            const data = doc.data();
            const tokens = Array.isArray(data.fcmTokens) ? data.fcmTokens.filter((t: any) => typeof t === 'string' && t.trim().length > 10) : [];
            
            if (tokens.length > 0) {
                usersWithTokensCount++;
                totalTokensCount += tokens.length;

                const isVerified = data.status === 'verified' || data.status === 'approved';
                if (isVerified) {
                    verifiedWithTokensCount++;
                } else {
                    incompleteWithTokensCount++;
                }

                candidateList.push({
                    id: doc.id,
                    name: data.name || data.fullName || 'Candidate',
                    email: data.email || '',
                    itsNumber: data.itsNumber || '',
                    gender: data.gender || '',
                    status: data.status || 'pending',
                    tokensCount: tokens.length
                });
            }
        });

        return NextResponse.json({
            success: true,
            totalUsers,
            usersWithTokensCount,
            totalTokensCount,
            verifiedWithTokensCount,
            incompleteWithTokensCount,
            candidates: candidateList
        });
    } catch (err: any) {
        console.error('[AdminPushStats] Error:', err);
        return NextResponse.json({ error: err?.message || 'Failed to fetch stats' }, { status: 500 });
    }
}
