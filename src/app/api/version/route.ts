import { NextResponse } from 'next/server';

export async function GET() {
    // This will return the BUILD_ID that the server-side process was started with.
    // When a new deployment happens on Vercel, new Lambdas are started with the new BUILD_ID.
    return NextResponse.json({
        version: process.env.NEXT_PUBLIC_BUILD_ID || 'dev'
    });
}
