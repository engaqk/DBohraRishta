import { NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebase/admin';

export const dynamic = 'force-dynamic';

interface PhoneEntry {
    phone: string;
    name?: string;
    source: 'firestore' | 'auth' | 'both';
}

function normalizePhone(raw: string): string | null {
    if (!raw) return null;
    let phone = raw.replace(/[\s\-()]/g, '');
    
    // If it starts with 00, replace with +
    if (phone.startsWith('00')) {
        phone = '+' + phone.substring(2);
    }
    
    // If it doesn't start with +, but looks like a valid number
    if (!phone.startsWith('+')) {
        if (/^\d{7,15}$/.test(phone)) {
            phone = '+' + phone;
        }
    }
    
    return /^\+\d{7,15}$/.test(phone) ? phone : null;
}

export async function GET(request: Request) {
    try {
        const authHeader = request.headers.get('Authorization');
        if (authHeader !== 'secure_admin_session_active') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (!adminDb || typeof adminDb.collection !== 'function') {
            return NextResponse.json({ error: 'Firebase Admin DB not configured.' }, { status: 503 });
        }
        
        const phoneMap = new Map<string, PhoneEntry>();

        // ── 1. Fetch from Firestore users collection ──────────────────────────
        const usersSnap = await adminDb.collection('users').get();
        usersSnap.docs.forEach(d => {
            const data = d.data() as Record<string, any>;
            const raw: string = data['mobile'] || data['mobileNumber'] || '';
            const phone = normalizePhone(raw);
            if (!phone) return;

            phoneMap.set(phone, {
                phone,
                name: data['name'] || undefined,
                source: 'firestore',
            });
        });

        // ── 2. Fetch from Firebase Auth ───────────────────────────────────────
        if (adminAuth && typeof adminAuth.listUsers === 'function') {
            let pageToken: string | undefined;
            do {
                const result = await adminAuth.listUsers(1000, pageToken);
                result.users.forEach(u => {
                    let phone: string | null = null;

                    // From internal mobile email convention (+919876543210@dbohrarishta.local)
                    if (u.email?.endsWith('@dbohrarishta.local')) {
                        phone = normalizePhone(u.email.replace('@dbohrarishta.local', ''));
                    }
                    
                    // From Firebase phone number field
                    if (!phone && u.phoneNumber) {
                        phone = normalizePhone(u.phoneNumber);
                    }

                    if (phone) {
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
