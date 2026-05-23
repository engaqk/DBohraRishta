import { NextResponse } from 'next/server';
import { adminAuth, adminDb, adminStorage } from '@/lib/firebase/admin';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { userId, idToken, deleteReason } = body;

        console.log('[delete-account-self] Request received for userId:', userId);

        if (!userId || !idToken) {
            return NextResponse.json({ error: 'userId and idToken are required' }, { status: 400 });
        }

        // 1. Verify Authentication
        if (!adminAuth) {
            return NextResponse.json({ error: 'Auth service not available' }, { status: 503 });
        }
        
        const decodedToken = await adminAuth.verifyIdToken(idToken);
        if (decodedToken.uid !== userId) {
            console.error('[delete-account-self] Unauthorized: UID mismatch', { decoded: decodedToken.uid, requested: userId });
            return NextResponse.json({ error: 'Unauthorized: UID mismatch' }, { status: 401 });
        }

        if (!adminDb) {
            return NextResponse.json({ error: 'Firestore service not available' }, { status: 503 });
        }

        // 2. Clear Firestore user data & subcollections
        const batch = adminDb.batch();

        // A. Delete notifications
        const notificationsRef = adminDb.collection('users').doc(userId).collection('notifications');
        const notificationsSnap = await notificationsRef.get();
        notificationsSnap.forEach(doc => batch.delete(doc.ref));

        // B. Delete admin_messages thread
        const threadRef = adminDb.collection('admin_messages').doc(userId).collection('thread');
        const threadSnap = await threadRef.get();
        threadSnap.forEach(doc => batch.delete(doc.ref));

        // C. Delete bookmarks where userId == userId
        const bookmarksRef = adminDb.collection('bookmarks');
        const bookmarksSnap1 = await bookmarksRef.where('userId', '==', userId).get();
        bookmarksSnap1.forEach(doc => batch.delete(doc.ref));
        
        // D. Delete bookmarks where profileId == userId
        const bookmarksSnap2 = await bookmarksRef.where('profileId', '==', userId).get();
        bookmarksSnap2.forEach(doc => batch.delete(doc.ref));

        // E. Delete rishta_requests where from == userId or to == userId
        const requestsRef = adminDb.collection('rishta_requests');
        const requestsSnap1 = await requestsRef.where('from', '==', userId).get();
        requestsSnap1.forEach(doc => batch.delete(doc.ref));
        const requestsSnap2 = await requestsRef.where('to', '==', userId).get();
        requestsSnap2.forEach(doc => batch.delete(doc.ref));

        // F. Delete profile_views where viewerId == userId or profileId == userId
        const viewsRef = adminDb.collection('profile_views');
        const viewsSnap1 = await viewsRef.where('viewerId', '==', userId).get();
        viewsSnap1.forEach(doc => batch.delete(doc.ref));
        const viewsSnap2 = await viewsRef.where('profileId', '==', userId).get();
        viewsSnap2.forEach(doc => batch.delete(doc.ref));

        // Commit the batch
        await batch.commit();

        // Get user data before deletion to keep an audit trail
        let targetUserName = 'Unknown';
        let targetItsNumber = 'Unknown';
        try {
            const userDoc = await adminDb.collection('users').doc(userId).get();
            if (userDoc.exists) {
                const uData = userDoc.data();
                targetUserName = uData?.name || 'Unknown';
                targetItsNumber = uData?.itsNumber || 'Unknown';
            }
        } catch (e) {
            console.error('[delete-account-self] Error fetching user data for audit:', e);
        }

        // Log Action in Permanent Audit Log
        try {
            const auditRef = adminDb.collection('admin_audit_logs').doc();
            await auditRef.set({
                adminId: 'self',
                action: 'candidate_deleted',
                targetUserId: userId,
                targetUserName: targetUserName,
                itsNumber: targetItsNumber,
                reason: deleteReason || 'No reason provided',
                timestamp: new Date()
            });
            console.log('[delete-account-self] Permanent audit log created for candidate deletion with reason.');
        } catch (auditErr: any) {
            console.error('[delete-account-self] Audit log write failed:', auditErr.message);
        }

        // G. Delete the user document itself
        await adminDb.collection('users').doc(userId).delete();

        // 3. Clean up files in storage under profiles/{userId}
        try {
            if (adminStorage) {
                let bucketName = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || 'dbohranisbat.firebasestorage.app';
                let bucket = adminStorage.bucket(bucketName);
                
                try {
                    await bucket.deleteFiles({ prefix: `profiles/${userId}/` });
                } catch (firstErr: any) {
                    if (firstErr.code === 404 && bucketName.includes('.firebasestorage.app')) {
                        bucketName = bucketName.replace('.firebasestorage.app', '.appspot.com');
                        bucket = adminStorage.bucket(bucketName);
                        await bucket.deleteFiles({ prefix: `profiles/${userId}/` });
                    } else {
                        throw firstErr;
                    }
                }
                console.log(`[delete-account-self] Cleaned up storage folder: profiles/${userId}/`);
            }
        } catch (storageErr: any) {
            console.warn('[delete-account-self] Non-critical storage cleanup error:', storageErr.message);
        }

        // 4. Delete user from Firebase Auth
        try {
            await adminAuth.deleteUser(userId);
            console.log('[delete-account-self] Deleted user from Firebase Auth successfully:', userId);
        } catch (authError: any) {
            console.warn(`[delete-account-self] Auth deletion failed or user already gone: ${authError.message}`);
        }

        return NextResponse.json({ success: true });

    } catch (error: any) {
        console.error('[delete-account-self] Error during self deletion:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
