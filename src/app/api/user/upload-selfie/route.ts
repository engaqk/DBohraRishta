import { NextResponse } from 'next/server';
import { adminAuth, adminDb, adminStorage } from '@/lib/firebase/admin';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
    try {
        const formData = await request.formData();
        const file = formData.get('file') as File | null;
        const userId = formData.get('userId') as string | null;
        const idToken = formData.get('idToken') as string | null;

        console.log('[upload-selfie] Received:', { 
            hasFile: !!file, 
            fileName: file ? file.name : 'not-a-file',
            userId: userId || 'missing', 
            hasToken: !!idToken 
        });

        if (!file || !userId || !idToken) {
            return NextResponse.json({ 
                error: 'File, userId, and ID Token are required',
                debug: { file: !!file, userId: !!userId, idToken: !!idToken }
            }, { status: 400 });
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

        let bucketName = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || 'dbohranisbat.firebasestorage.app';
        let bucket = adminStorage.bucket(bucketName);
        let filename = `profiles/${userId}/selfie_${Date.now()}.jpg`;
        let fileRef = bucket.file(filename);

        console.log('[upload-selfie] Saving file to bucket:', bucket.name, 'as', filename);

        const bytes = await file.arrayBuffer();
        try {
            await fileRef.save(Buffer.from(bytes), {
                metadata: { contentType: 'image/jpeg' },
            });
        } catch (saveErr: any) {
            // Firebase Admin SDK often fails with 404 on '.firebasestorage.app' bucket aliases 
            // because it expects the underlying GCP bucket name.
            if (saveErr.code === 404 && bucketName.includes('.firebasestorage.app')) {
                console.log('[upload-selfie] Bucket alias not found natively, falling back to .appspot.com...');
                bucketName = bucketName.replace('.firebasestorage.app', '.appspot.com');
                bucket = adminStorage.bucket(bucketName);
                fileRef = bucket.file(filename);
                await fileRef.save(Buffer.from(bytes), {
                    metadata: { contentType: 'image/jpeg' },
                });
            } else {
                throw saveErr; // Rethrow if it's not a 404 or can't be fixed by fallback
            }
        }

        // Use permanent public URL format for simplicity in display
        const downloadUrl = `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodeURIComponent(filename)}?alt=media`;

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
