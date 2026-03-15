import { NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebase/admin-config';

export const dynamic = 'force-dynamic';

interface PhoneEntry {
    phone: string;
    name?: string;
    source: 'firestore' | 'auth' | 'both';
}

export async function GET() {
    if (!adminDb) {
        return NextResponse.json({ error: 'Firebase Admin not configured.' }, { status: 503 });
    }

    try {
        const phoneMap = new Map<string, PhoneEntry>();

        // ── 1. Fetch from Firestore users collection ──────────────────────────
        const usersSnap = await adminDb.collection('users').get();
        usersSnap.docs.forEach(d => {
            const data = d.data() as Record<string, any>;
            const raw: string = data['mobile'] || data['mobileNumber'] || '';
            if (!raw) return;
            const phone = raw.replace(/[\s\-()]/g, '');
            if (!/^\+\d{10,15}$/.test(phone)) return;

            phoneMap.set(phone, {
                phone,
                name: data['name'] || undefined,
                source: 'firestore',
            });
        });

        // ── 2. Fetch from Firebase Auth ───────────────────────────────────────
        // Mobile-registered users have internal emails like: +919876543210@dbohrarishta.local
        // Also check if any users have a real phoneNumber field in Auth
        if (adminAuth) {
            let pageToken: string | undefined;
            do {
                const result = await adminAuth.listUsers(1000, pageToken);
                result.users.forEach(u => {
                    // From internal mobile email convention
                    if (u.email?.endsWith('@dbohrarishta.local')) {
                        const phone = u.email.replace('@dbohrarishta.local', '');
                        if (/^\+\d{10,15}$/.test(phone)) {
                            const existing = phoneMap.get(phone);
                            phoneMap.set(phone, {
                                phone,
                                name: existing?.name || u.displayName || undefined,
                                source: existing ? 'both' : 'auth',
                            });
                        }
                    }
                    // From Firebase phone number field (if phone auth was ever used)
                    if (u.phoneNumber) {
                        const phone = u.phoneNumber;
                        const existing = phoneMap.get(phone);
                        phoneMap.set(phone, {
                            phone,
                            name: existing?.name || u.displayName || undefined,
                            source: existing ? 'both' : 'auth',
                        });
                    }
                });
                pageToken = result.pageToken;
            } while (pageToken);
        }

        const numbers = Array.from(phoneMap.values()).sort((a, b) =>
            (a.name || a.phone).localeCompare(b.name || b.phone)
        );

        return NextResponse.json({ success: true, total: numbers.length, numbers });

    } catch (error: any) {
        console.error('SMS Numbers fetch error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
