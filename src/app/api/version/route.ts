import { NextResponse } from 'next/server';

export const dynamic = 'force-static';
export const revalidate = false;

export async function GET() {
    // This returns the version generated at build time.
    return NextResponse.json({
        version: process.env.NEXT_PUBLIC_BUILD_ID || 'dev'
    });
}
