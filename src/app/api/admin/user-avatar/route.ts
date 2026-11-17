import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

export const dynamic = 'force-dynamic';

/**
 * On-demand image streaming route for candidate photos in the Admin Panel.
 * Converts Firestore base64 strings to optimized binary images with browser caching.
 * Keeps bulk dashboard payloads light (<100KB) and loads images fast and progressively.
 */
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const userId = searchParams.get('userId');
        const type = searchParams.get('type') || 'libas';
        const token = searchParams.get('token') || request.headers.get('Authorization');

        if (token !== 'secure_admin_session_active') {
            return new NextResponse('Unauthorized', { status: 401 });
        }

        if (!userId || !adminDb) {
            return new NextResponse('Missing userId or adminDb unavailable', { status: 400 });
        }

        const userDoc = await adminDb.collection('users').doc(userId).get();
        if (!userDoc.exists) {
            return new NextResponse('User not found', { status: 404 });
        }

        const data = userDoc.data() || {};
        let rawImage: string | null = null;

        if (type === 'selfie') {
            rawImage = data.selfieImageUrl || data.selfieUrl || data.libasImageUrl || null;
        } else if (type === 'its') {
            rawImage = data.itsImageUrl || null;
        } else {
            // Default: libas image with fallback to selfie
            rawImage = data.libasImageUrl || data.selfieImageUrl || data.selfieUrl || null;
        }

        if (!rawImage || typeof rawImage !== 'string' || rawImage.length < 20) {
            return new NextResponse('Image not found', { status: 404 });
        }

        // If it's already a hosted URL (e.g. Firebase Storage, Cloudinary, AWS S3)
        if (rawImage.startsWith('http://') || rawImage.startsWith('https://')) {
            return NextResponse.redirect(rawImage);
        }

        // Parse standard Data URL: data:image/jpeg;base64,...
        const match = rawImage.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
        if (match && match.length === 3) {
            const mimeType = match[1];
            const buffer = Buffer.from(match[2], 'base64');

            return new NextResponse(buffer, {
                status: 200,
                headers: {
                    'Content-Type': mimeType,
                    'Content-Length': buffer.length.toString(),
                    'Cache-Control': 'public, max-age=86400, stale-while-revalidate=43200',
                }
            });
        }

        // Raw base64 string without data prefix
        try {
            const buffer = Buffer.from(rawImage, 'base64');
            return new NextResponse(buffer, {
                status: 200,
                headers: {
                    'Content-Type': 'image/jpeg',
                    'Content-Length': buffer.length.toString(),
                    'Cache-Control': 'public, max-age=86400, stale-while-revalidate=43200',
                }
            });
        } catch {
            return new NextResponse('Invalid image data', { status: 400 });
        }

    } catch (err: any) {
        console.error('[user-avatar] Error streaming candidate image:', err);
        return new NextResponse(err.message || 'Error', { status: 500 });
    }
}
