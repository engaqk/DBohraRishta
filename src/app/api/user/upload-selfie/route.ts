import { NextResponse } from 'next/server';
import { adminAuth, adminDb, adminStorage } from '@/lib/firebase/admin';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
    try {
        const formData = await request.formData();
        const file = formData.get('file') as File;
        const userId = formData.get('userId') as string;
        const idToken = request.headers.get('idToken') as string;

        if (!file || !userId || !idToken) {
            console.error('[upload-selfie] Missing fields:', { file: !!file, userId, idToken: !!idToken });
            return NextResponse.json({ error: 'File, userId, and ID Token are required' }, { status: 400 });
        }

        // 1. Verify Authentication
        if (!adminAuth) {
             return NextResponse.json({ error: 'Auth service not available' }, { status: 503 });
        }
        
        const decodedToken = await adminAuth.verifyIdToken(idToken);
        if (decodedToken.uid !== userId) {
            console.error('[upload-selfie] Unauthorized: UID mismatch', { decoded: decodedToken.uid, requested: userId });
            return NextResponse.json({ error: 'Unauthorized: UID mismatch' }, { status: 401 });
        }

        // 2. Upload to Storage
        if (!adminStorage) {
             console.error('[upload-selfie] Admin Storage not available');
             return NextResponse.json({ error: 'Storage service not available' }, { status: 503 });
        }

        const bucket = adminStorage.bucket();
        const filename = `profiles/${userId}/selfie_${Date.now()}.jpg`;
        const fileRef = bucket.file(filename);

        console.log('[upload-selfie] Saving file to bucket:', bucket.name, 'as', filename);

        const bytes = await file.arrayBuffer();
        await fileRef.save(Buffer.from(bytes), {
            metadata: {
                contentType: 'image/jpeg',
            },
        });

        // Use permanent public URL format for simplicity in display
        const downloadUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(filename)}?alt=media`;

        // 3. Update Firestore
        if (!adminDb) {
             return NextResponse.json({ error: 'Firestore service not available' }, { status: 503 });
        }

        console.log('[upload-selfie] Updating Firestore with URL:', downloadUrl);
        await adminDb.collection('users').doc(userId).update({
            selfieUrl: downloadUrl,
            selfieStatus: 'pending',
            isPhotoVerified: false,
            updatedAt: new Date()
        });

        return NextResponse.json({ success: true, downloadUrl });

    } catch (error: any) {
        console.error('[upload-selfie] POST Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
