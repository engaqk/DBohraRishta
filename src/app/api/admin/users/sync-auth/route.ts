import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import * as admin from 'firebase-admin';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
    try {
        if (!adminAuth || !adminDb) {
            return NextResponse.json({ error: 'Admin service not configured' }, { status: 503 });
        }

        const authHeader = request.headers.get('Authorization');
        if (authHeader !== 'secure_admin_session_active') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        let pageToken: string | undefined;
        let syncCount = 0;
        let skippedCount = 0;
        const syncedUids: string[] = [];

        do {
            const listUsersResult = await adminAuth.listUsers(1000, pageToken);
            
            for (const userRecord of listUsersResult.users) {
                // Skip the admin service account if it exists
                if (userRecord.uid === 'admin-panel-service-account') continue;

                // 1. Identify mobile number
                const mobileFromEmail = userRecord.email?.endsWith('@dbohrarishta.local')
                    ? userRecord.email.replace('@dbohrarishta.local', '')
                    : null;
                
                const mobile = mobileFromEmail || userRecord.phoneNumber;

                if (!mobile) {
                    skippedCount++;
                    continue;
                }

                // Clean/Normalize the number for Firestore storage
                let cleanedMobile = mobile.replace(/[\s\-()+]/g, ''); // strip everything including + for check
                if (/^\d{7,15}$/.test(cleanedMobile)) {
                    cleanedMobile = '+' + cleanedMobile;
                } else {
                    skippedCount++;
                    continue;
                }

                // 2. Check if document exists in 'users' collection
                const userDocRef = adminDb.collection('users').doc(userRecord.uid);
                const userDoc = await userDocRef.get();

                if (!userDoc.exists) {
                    // 3. Create skeleton document
                    await userDocRef.set({
                        uid: userRecord.uid,
                        mobile: cleanedMobile,
                        email: userRecord.email && !userRecord.email.endsWith('@dbohrarishta.local') ? userRecord.email : null,
                        name: userRecord.displayName || null,
                        status: 'auth_background', // Distinct status for users synced from auth
                        isCandidateFormComplete: false,
                        isItsVerified: false,
                        createdAt: admin.firestore.Timestamp.fromDate(new Date(userRecord.metadata.creationTime)),
                        syncedFromAuth: true,
                        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                    });
                    syncCount++;
                    syncedUids.push(userRecord.uid);
                } else {
                    // Pre-registered users: if they don't have mobile field, we could update it, 
                    // but usually they do. Let's just skip to avoid overwriting real data.
                    skippedCount++;
                }
            }

            pageToken = listUsersResult.pageToken;
        } while (pageToken);

        return NextResponse.json({ 
            success: true, 
            syncedCount: syncCount, 
            skippedCount,
            message: `Successfully synced ${syncCount} users from Firebase Auth to Firestore.` 
        });

    } catch (error: any) {
        console.error('Error syncing auth users:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
