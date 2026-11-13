import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const filePath = path.join(process.cwd(), 'public', 'downloads', '53DBohraRishta.apk');
        
        if (!fs.existsSync(filePath)) {
            // Fallback to public root
            const fallbackPath = path.join(process.cwd(), 'public', '53DBohraRishta.apk');
            if (fs.existsSync(fallbackPath)) {
                const fileBuffer = fs.readFileSync(fallbackPath);
                return new NextResponse(fileBuffer, {
                    headers: {
                        'Content-Type': 'application/vnd.android.package-archive',
                        'Content-Disposition': 'attachment; filename="53DBohraRishta.apk"',
                        'Content-Length': fileBuffer.length.toString(),
                        'Cache-Control': 'public, max-age=3600'
                    }
                });
            }
            return NextResponse.json({ error: 'APK file not found' }, { status: 404 });
        }

        const fileBuffer = fs.readFileSync(filePath);
        return new NextResponse(fileBuffer, {
            headers: {
                'Content-Type': 'application/vnd.android.package-archive',
                'Content-Disposition': 'attachment; filename="53DBohraRishta.apk"',
                'Content-Length': fileBuffer.length.toString(),
                'Cache-Control': 'public, max-age=3600'
            }
        });
    } catch (error: any) {
        console.error('Error serving APK download:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
