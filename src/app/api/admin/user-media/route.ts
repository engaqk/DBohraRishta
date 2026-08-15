import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const authHeader = request.headers.get('Authorization');
        if (authHeader !== 'secure_admin_session_active') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const userId = searchParams.get('userId');

        if (!userId) {
            return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
        }

        const userDoc = await adminDb.collection('users').doc(userId).get();
        if (!userDoc.exists) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        const data = userDoc.data();
        
        return NextResponse.json({
            videoIntroUrl: data?.videoIntroUrl || null,
            voiceIntroUrl: data?.voiceIntroUrl || null,
        });

    } catch (error: any) {
        console.error('[user-media] Error:', error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
