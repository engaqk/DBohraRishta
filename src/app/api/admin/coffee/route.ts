import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import * as admin from 'firebase-admin';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
    try {
        if (!adminDb) {
            return NextResponse.json({ error: 'Firebase Admin not configured' }, { status: 503 });
        }

        const docRef = adminDb.collection('system_settings').doc('coffee');
        const snap = await docRef.get();

        if (!snap.exists) {
            return NextResponse.json({
                success: true,
                settings: {
                    isCoffeeActive: false,
                    qrCodeImageUrl: '',
                    upiId: '',
                    coffeeTitle: 'Buy Us a Coffee / Support Platform ☕',
                    coffeeNote: 'Support server and maintenance costs for 53DBohraRishta.',
                    updatedAt: null
                }
            });
        }

        const data = snap.data() || {};
        return NextResponse.json({
            success: true,
            settings: {
                isCoffeeActive: !!data.isCoffeeActive,
                qrCodeImageUrl: data.qrCodeImageUrl || '',
                upiId: data.upiId || '',
                coffeeTitle: data.coffeeTitle || 'Buy Us a Coffee / Support Platform ☕',
                coffeeNote: data.coffeeNote || '',
                updatedAt: data.updatedAt || null
            }
        });
    } catch (e: any) {
        console.error('Error fetching coffee settings:', e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const authHeader = req.headers.get('Authorization');
        if (authHeader !== 'secure_admin_session_active') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (!adminDb) {
            return NextResponse.json({ error: 'Firebase Admin not configured' }, { status: 503 });
        }

        const body = await req.json();
        const { isCoffeeActive, qrCodeImageUrl, upiId, coffeeTitle, coffeeNote } = body;

        const docRef = adminDb.collection('system_settings').doc('coffee');
        const updatePayload: any = {
            isCoffeeActive: !!isCoffeeActive,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        };

        if (typeof qrCodeImageUrl !== 'undefined') updatePayload.qrCodeImageUrl = qrCodeImageUrl;
        if (typeof upiId !== 'undefined') updatePayload.upiId = upiId.trim();
        if (typeof coffeeTitle !== 'undefined') updatePayload.coffeeTitle = coffeeTitle.trim();
        if (typeof coffeeNote !== 'undefined') updatePayload.coffeeNote = coffeeNote.trim();

        await docRef.set(updatePayload, { merge: true });

        return NextResponse.json({
            success: true,
            message: `Buy Me a Coffee button is now ${isCoffeeActive ? 'ENABLED' : 'DISABLED'}.`
        });
    } catch (e: any) {
        console.error('Error updating coffee settings:', e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
