import { NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebase/admin';
import nodemailer from 'nodemailer';
import { isEmailBlocked } from '@/lib/emailStatusServer';

export const dynamic = 'force-dynamic';

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.GMAIL_USER?.trim(),
        pass: process.env.GMAIL_APP_PASSWORD?.trim(),
    },
});

export async function GET(req: Request) {
    return handleRequest(req);
}

export async function POST(req: Request) {
    return handleRequest(req);
}

async function handleRequest(req: Request) {
    try {
        const url = new URL(req.url);
        const testEmail = url.searchParams.get('testEmail');
        
        let targetEmails: string[] = [];

        if (testEmail) {
            targetEmails.push(testEmail);
            console.log(`Running in test mode. Targeting: ${testEmail}`);
        } else {
            // Protect this when running in prod for all users
            const authHeader = req.headers.get('Authorization');
            const cronSecret = process.env.CRON_SECRET; // Optional: if triggering via Vercel Cron
            
            if (authHeader !== 'secure_admin_session_active' && req.headers.get('Authorization') !== `Bearer ${cronSecret}`) {
                return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
            }

            if (!adminDb || !adminAuth) {
                return NextResponse.json({ error: 'Firebase Admin not configured.' }, { status: 503 });
            }

            console.log("Fetching all registered candidates...");
            const emailSet = new Set<string>();
            const usersSnapshot = await adminDb.collection('users').get();
            
            usersSnapshot.docs.forEach(doc => {
                const u = doc.data();
                if (u.email) {
                    const e = u.email.toString().trim().toLowerCase();
                    if (e.includes('@')) {
                        emailSet.add(e);
                    }
                }
            });

            // Also check Firebase Auth users just to be safe and comprehensive
            try {
                let nextPageToken;
                do {
                    const listUsersResult = await adminAuth.listUsers(1000, nextPageToken);
                    listUsersResult.users.forEach((userRecord) => {
                        if (userRecord.email) {
                            emailSet.add(userRecord.email.toLowerCase().trim());
                        }
                    });
                    nextPageToken = listUsersResult.pageToken;
                } while (nextPageToken);
            } catch (e) {
                console.error("Error fetching users from Auth:", e);
            }

            const allEmails = Array.from(emailSet);
            console.log(`Found ${allEmails.length} total unique emails. Filtering blocked...`);

            for (const email of allEmails) {
                if (!(await isEmailBlocked(email))) {
                    targetEmails.push(email);
                }
            }
            console.log(`Sending to ${targetEmails.length} active (non-blocked) emails.`);
        }

        if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
            return NextResponse.json({ error: "Email credentials missing on server." }, { status: 500 });
        }

        if (targetEmails.length === 0) {
            return NextResponse.json({ success: true, message: "No active emails found." });
        }

        const title = "Exclusive Update: Maximize Your Match Probability on 53DBohraRishta";
        const messageHtml = `
            <div style="font-family:Georgia,serif;max-width:560px;margin:auto;padding:32px;border:1px solid #eee;border-radius:12px;background:#fffafb">
                <h2 style="color:#881337;margin-bottom:8px">An Exclusive Privilege for Our Members 🌟</h2>
                <p>As-salaamu alaykum,</p>
                <p>We are delighted to have you as a registered member of <strong>53DBohraRishta</strong>.</p>
                
                <p>This platform has been created completely <strong>free of cost</strong> with all premium features unlocked. It is dedicated to the khidmat of our community and to seek the Dua Mubarak of our beloved Aqa Maula (TUS).</p>

                <div style="background:#fff;border:1px dashed #D4AF37;padding:22px;border-radius:16px;margin:24px 0;box-shadow:0 4px 6px -1px rgba(0,0,0,0.05)">
                    <p style="margin:0 0 10px;font-weight:bold;color:#881337;font-size:18px;text-align:center;">You are an Owner of this Platform</p>
                    <p style="margin:0;color:#333;font-size:15px;line-height:1.6">
                        Because this platform is built <em>for</em> you, we consider you an owner of this initiative. With ownership comes a shared responsibility. We kindly urge you to <strong>share 53DBohraRishta within your circle</strong>, with friends, and family members who might be looking for a match.
                    </p>
                </div>

                <h3 style="color:#881337;">Why Share?</h3>
                <p>The mathematics of finding a Rishta is simple: <strong>The more candidates registered on the platform, the higher your probability of finding the perfect match.</strong></p>
                <p>By helping the platform grow, you are directly increasing the chances of success for yourself and others, creating a larger pool of potential Rishtas.</p>
                <p>In a larger perspective, this collective effort brings us all together and earns us the immense sawab and Dua Mubarak of Aqa Maula (TUS).</p>

                <p>Let's work together to make this platform a success for everyone. Please share the link below with your contacts or forward this directly on WhatsApp:</p>
                
                <div style="text-align:center;margin-top:30px;margin-bottom:30px">
                    <a href="https://53dbohrarishta.in" style="display:inline-block;background:#881337;color:#fff;padding:14px 24px;margin:5px;text-decoration:none;border-radius:12px;font-weight:bold;box-shadow:0 10px 15px -3px rgba(136,19,55,0.3)">
                        🌐 Open 53DBohraRishta
                    </a>
                    <a href="https://wa.me/?text=Struggling%20to%20find%20verified%20and%20compatible%20Rishtas%20within%20our%20community%3F%20Privacy%20concerns%20and%20high%20fees%20shouldn%27t%20stand%20in%20the%20way%20of%20a%20blessed%20union.%20%0A%0ACheck%20out%2053DBohraRishta%20-%20A%20completely%20free%20Rishta%20platform%20exclusively%20curated%20for%20Dawoodi%20Bohra%20candidates%21%20%0A%0A%E2%9C%A8%20Why%20join%3F%0A-%20100%25%20Free%20with%20Premium%20Features%0A-%20Strict%20Privacy%20Control%20for%20Photos%0A-%20Verified%20%26%20Trustworthy%20Profiles%0A-%20Direct%20Interest%20Requests%0A%0AFind%20your%20perfect%20match%20and%20earn%20the%20Dua%20Mubarak%20of%20Aqa%20Maula%20%28TUS%29.%20%0ARegister%20for%20free%20today%3A%20https%3A%2F%2F53dbohrarishta.in" style="display:inline-block;background:#25D366;color:#fff;padding:14px 24px;margin:5px;text-decoration:none;border-radius:12px;font-weight:bold;box-shadow:0 10px 15px -3px rgba(37,211,102,0.3)">
                        📱 Share on WhatsApp
                    </a>
                </div>

                <p>Thank you for your support and participation.</p>
                <p>Was Salaam,<br/><strong>53DBohraRishta Team</strong></p>
                
                <hr style="border:0;border-top:1px solid #eee;margin:32px 0"/>
                <p style="font-size:10px;color:#bbb;text-align:center;line-height:1.5">You are receiving this because you are registered on 53DBohraRishta.<br/>&copy; ${new Date().getFullYear()} 53DBohraRishta Team</p>
            </div>
        `;

        let emailSuccessCount = 0;
        const chunkSize = 50;

        for (let i = 0; i < targetEmails.length; i += chunkSize) {
            const chunk = targetEmails.slice(i, i + chunkSize);
            const mailOptions = {
                from: `"53DBohraRishta" <${process.env.GMAIL_USER}>`,
                to: process.env.GMAIL_USER, // Required by some SMTPs when using BCC
                bcc: chunk.join(', '),
                subject: title,
                html: messageHtml,
            };

            try {
                console.log(`Sending email chunk ${i / chunkSize + 1} to ${chunk.length} recipients...`);
                await transporter.sendMail(mailOptions);
                emailSuccessCount += chunk.length;
            } catch (e: any) {
                console.error(`Email error on chunk ${i / chunkSize + 1}:`, e);
                if (testEmail) {
                    return NextResponse.json({ error: "Test email sending failed: " + e.message }, { status: 500 });
                }
            }
        }

        return NextResponse.json({
            success: true,
            emailsSent: emailSuccessCount,
            message: `Successfully scheduled and sent ${emailSuccessCount} emails.`
        });

    } catch (error: any) {
        console.error("CRITICAL ERROR IN SCHEDULE SHARE EMAIL:", error);
        return NextResponse.json({
            success: false,
            error: error.message || "Unknown Server Error"
        }, { status: 500 });
    }
}
