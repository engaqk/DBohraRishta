import { NextResponse } from 'next/server';
import crypto from 'crypto';

const OTP_SECRET = process.env.OTP_SECRET || 'dbohrarishta_super_secret_otp_key_2026';

export async function POST(req: Request) {
    try {
        const { phone } = await req.json();

        if (!phone) {
            return NextResponse.json({ error: 'Phone number is required' }, { status: 400 });
        }

        // 1. Generate 6-digit OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();

        // 2. Compute Expiry (10 minutes)
        const expiry = Date.now() + 10 * 60 * 1000;

        // 3. Create a verification hash (OTP + Phone + Expiry)
        const data = `${phone}.${otp}.${expiry}`;
        const hash = crypto.createHmac('sha256', OTP_SECRET).update(data).digest('hex');

        // 4. Integrations (Fully Free Alternatives)
        // Here we attempt to use Fast2SMS (Free Testing SMS in India)
        // If the key is missing or fails, it will still work via internal console logging!
        const FAST2SMS_KEY = process.env.FAST2SMS_API_KEY; // Optional
        let smsStatus = "Simulated (Free Mode)";

        if (FAST2SMS_KEY) {
            try {
                // Remove +91 or spaces for Fast2SMS generic format
                const cleanPhone = phone.replace(/[\s\-\+]/g, '').slice(-10);
                const resp = await fetch('https://www.fast2sms.com/dev/bulkV2', {
                    method: 'POST',
                    headers: {
                        'authorization': FAST2SMS_KEY,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        variables_values: otp,
                        route: "otp",
                        numbers: cleanPhone,
                    }),
                });
                const result = await resp.json();
                if (result.return) {
                    smsStatus = "Sent via Fast2SMS";
                } else {
                    console.error("Fast2SMS Error", result);
                    smsStatus = "Fast2SMS Failed, fallback to Simulated";
                }
            } catch (err) {
                console.error("SMS Provider Error", err);
            }
        }

        // Log to console for 100% completely free development
        if (smsStatus.includes("Simulated")) {
            console.log(`\n============================`);
            console.log(`📱 SMS OTP INTERCEPTED`);
            console.log(`📞 To: ${phone}`);
            console.log(`🔑 OTP: ${otp}`);
            console.log(`(Configure FAST2SMS_API_KEY for real SMS)`);
            console.log(`============================\n`);
        }

        // 5. Send Hash to Frontend (NOT the OTP itself)
        return NextResponse.json({
            success: true,
            hash,
            expiry,
            phone,
            status: smsStatus
        });

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
