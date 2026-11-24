import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import * as admin from 'firebase-admin';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
    try {
        if (!adminDb) {
            return NextResponse.json({ error: 'Firebase Admin not configured' }, { status: 503 });
        }

        const docRef = adminDb.collection('system_settings').doc('soulsync');
        const snap = await docRef.get();

        if (!snap.exists) {
            return NextResponse.json({
                success: true,
                settings: {
                    isSoulSyncActive: false,
                    dropHour: 20, // 8:00 PM default
                    enabledAt: null,
                    updatedAt: null
                }
            });
        }

        const data = snap.data() || {};
        return NextResponse.json({
            success: true,
            settings: {
                isSoulSyncActive: !!data.isSoulSyncActive,
                dropHour: data.dropHour || 20,
                enabledAt: data.enabledAt || null,
                updatedAt: data.updatedAt || null,
                announcementNote: data.announcementNote || ''
            }
        });
    } catch (e: any) {
        console.error('Error fetching SoulSync settings:', e);
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
        const { isSoulSyncActive, announcementNote, notifyUsers = false } = body;

        const docRef = adminDb.collection('system_settings').doc('soulsync');
        await docRef.set({
            isSoulSyncActive: !!isSoulSyncActive,
            dropHour: 20,
            announcementNote: announcementNote || null,
            enabledAt: isSoulSyncActive ? admin.firestore.FieldValue.serverTimestamp() : null,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        // Optional broadcast notifications when enabled
        if (isSoulSyncActive && notifyUsers) {
            const usersSnap = await adminDb.collection('users')
                .where('isItsVerified', '==', true)
                .select('name', 'email')
                .get();

            const batch = adminDb.batch();
            let count = 0;

            usersSnap.docs.forEach((doc) => {
                if (count < 450) { // Keep within single batch safety
                    const notifRef = adminDb.collection('users').doc(doc.id).collection('notifications').doc();
                    batch.set(notifRef, {
                        type: 'soulsync_daily_drop',
                        title: '✨ SoulSync 8:00 PM Drop is Active!',
                        message: 'Bismillah! 3 handpicked verified alignments are ready for you in the SoulSync tab.',
                        isRead: false,
                        createdAt: admin.firestore.FieldValue.serverTimestamp()
                    });
                    count++;
                }
            });

            if (count > 0) {
                batch.commit().catch(err => console.error('Error committing notification batch:', err));
            }
        }

        return NextResponse.json({
            success: true,
            isSoulSyncActive: !!isSoulSyncActive,
            message: `SoulSync feature successfully ${isSoulSyncActive ? 'ENABLED' : 'DISABLED'}.`
        });
    } catch (e: any) {
        console.error('Error updating SoulSync settings:', e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
