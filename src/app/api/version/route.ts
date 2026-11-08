import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
    // VERCEL_GIT_COMMIT_SHA is stable per deployment on Vercel
    // NEXT_PUBLIC_BUILD_ID is updated on every build
    const version = process.env.VERCEL_GIT_COMMIT_SHA || process.env.NEXT_PUBLIC_BUILD_ID || process.env.VERCEL_URL || 'v1';
    
    return NextResponse.json({ 
        version,
        timestamp: Date.now()
    }, {
        headers: {
            'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
        }
    });
}
