import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
    // VERCEL_GIT_COMMIT_SHA is stable per deployment on Vercel
    // NEXT_PUBLIC_VERCEL_ENV is also useful, but we need a unique build ID
    const version = process.env.VERCEL_GIT_COMMIT_SHA || process.env.VERCEL_URL || 'development';
    
    return NextResponse.json({ 
        version,
        timestamp: Date.now()
    });
}
