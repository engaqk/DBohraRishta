import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

export const dynamic = 'force-dynamic';

/**
 * On-demand image streaming route for candidate photos in the Admin Panel.
 * Converts Firestore base64 strings to optimized binary images with browser caching.
 * Keeps bulk dashboard payloads light (<100KB) and loads images fast and progressively.
 * Always returns 200 OK with elegant Bohra SVGs when images are pending, eliminating 404s.
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
            rawImage = data.selfieImageUrl || data.selfieUrl || data.libasImageUrl || data.photoUrl || null;
        } else if (type === 'its') {
            rawImage = data.itsImageUrl || data.itsCardUrl || data.itsImage || data.itsPhoto || data.itsDoc || data.idCardUrl || null;
        } else {
            // Default: libas image with fallback to selfie or other uploaded photos
            rawImage = data.libasImageUrl || data.selfieImageUrl || data.selfieUrl || data.photoUrl || data.extraImageUrl || null;
        }

        // If no image is uploaded, return clean 200 SVGs/redirects instead of 404
        if (!rawImage || typeof rawImage !== 'string' || rawImage.length < 20) {
            if (type === 'its') {
                const itsPlaceholderSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96">
  <rect width="96" height="96" rx="14" fill="#FFF7ED"/>
  <rect x="4" y="4" width="88" height="88" rx="10" fill="#FFFFFF" stroke="#FDBA74" stroke-width="2"/>
  <rect x="24" y="16" width="48" height="32" rx="6" fill="#881337" fill-opacity="0.12"/>
  <text x="48" y="38" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="14" font-weight="900" fill="#881337" text-anchor="middle">ITS</text>
  <text x="48" y="66" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="8.5" font-weight="800" fill="#64748B" text-anchor="middle">NOT UPLOADED</text>
  <text x="48" y="78" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="7.5" font-weight="600" fill="#94A3B8" text-anchor="middle">Card Pending</text>
</svg>`;
                return new NextResponse(itsPlaceholderSvg, {
                    status: 200,
                    headers: {
                        'Content-Type': 'image/svg+xml',
                        'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
                    }
                });
            }

            // Fallback for libas / selfie
            const name = encodeURIComponent(data.name || 'User');
            return NextResponse.redirect(`https://ui-avatars.com/api/?name=${name}&background=881337&color=ffffff&size=128&bold=true`);
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
