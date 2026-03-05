
import fs from 'fs';

const filePath = 'd:\\BohraShaadi\\dbohranisbat\\src\\components\\RishtaDashboard.tsx';
let content = fs.readFileSync(filePath, 'utf8');

const notifyCall = `            // Integrated Hybrid Email Notifications for Acceptance
            notifyRequestAccepted({
                acceptorName: myProfile?.name || 'Candidate',
                acceptorMobile: acceptMobile,
                acceptorEmail: acceptEmail,
                requesterEmail: acceptingRequest.otherUserEmail,
                requesterName: acceptingRequest.otherUserName
            }).catch(e => console.error("Email notify error", e));`;

const searchBlock = `            // 1. Notify the one who accepted (the current user) + Admin
            if (acceptEmail && acceptEmail.includes('@')) {
                try {
                    await fetch("/api/notify", {
                        method: "POST",
                        body: JSON.stringify({
                            to: acceptEmail,
                            cc: adminEmail,
                            subject: "Interest Request Accepted - Contact Details Shared",
                            html: \`
                                <div style="font-family: serif; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
                                    <h2 style="color: #881337;">Alhamdulillah! Connection Successful</h2>
                                    <p>You have accepted the interest request from <strong>\${acceptingRequest.otherUserName}</strong>.</p>
                                    <p>Your contact details (Mobile: \${acceptMobile}, Email: \${acceptEmail}) have been shared with them.</p>
                                    <p>You can now see their unblurred photos and full details on your dashboard under "Unblurred Alignments".</p>
                                    <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
                                    <p style="font-size: 10px; color: #999;">DBohraRishta Notification System</p>
                                </div>
                            \`
                        })
                    });
                } catch (e) { }
            }

            // 2. Notify the requester + Admin
            if (acceptingRequest.otherUserEmail && acceptingRequest.otherUserEmail.includes('@')) {
                try {
                    await fetch("/api/notify", {
                        method: "POST",
                        body: JSON.stringify({
                            to: acceptingRequest.otherUserEmail,
                            cc: adminEmail,
                            subject: "Interest Request Accepted! - DBohraRishta",
                            html: \`
                                <div style="font-family: serif; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
                                    <h2 style="color: #881337;">Mubarak! Your Interest Request was Accepted</h2>
                                    <p><strong>\${myProfile?.name}</strong> has accepted your interest request.</p>
                                    <p>Their contact details are now visible on your dashboard under "Unblurred Alignments".</p>
                                    <p><strong>Contact Info:</strong></p>
                                    <ul style="list-style: none; padding: 0;">
                                        <li>Mobile: \${acceptMobile}</li>
                                        <li>Email: \${acceptEmail}</li>
                                    </ul>
                                    <p>Login now to see their full profile and photos!</p>
                                    <div style="margin-top: 25px;">
                                        <a href="https://53dbohrarishta.in" style="background: #881337; color: white; padding: 12px 25px; text-decoration: none; border-radius: 8px; font-weight: bold;">Go to Dashboard</a>
                                    </div>
                                    <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
                                    <p style="font-size: 10px; color: #999;">DBohraRishta Notification System</p>
                                </div>
                            \`
                        })
                    });
                } catch (e) { }
            }`;

if (content.includes(searchBlock)) {
    content = content.replace(searchBlock, notifyCall);

    // Also need to import notifyRequestAccepted
    if (!content.includes('import { notifyRequestAccepted')) {
        content = content.replace("import { notifyAdminNewRegistration } from '@/lib/emailService';", "import { notifyAdminNewRegistration, notifyRequestAccepted } from '@/lib/emailService';");
    }

    fs.writeFileSync(filePath, content);
    console.log('Successfully updated RishtaDashboard.tsx with email helper');
} else {
    console.log('Block not found, checking if it was already replaced or slightly different...');
    // Fallback search with less whitespace sensitivity
    const simplerRegex = /\/\/ 1\. Notify the one who accepted[\s\S]*?Notification System<\/p>\s+<\/div>\s+\`[\s\S]*?\}\s+catch \(e\) \{ \}\s+\}/;
    if (simplerRegex.test(content)) {
        content = content.replace(simplerRegex, notifyCall);
        if (!content.includes('import { notifyRequestAccepted')) {
            content = content.replace("import { notifyAdminNewRegistration } from '@/lib/emailService';", "import { notifyAdminNewRegistration, notifyRequestAccepted } from '@/lib/emailService';");
        }
        fs.writeFileSync(filePath, content);
        console.log('Successfully updated RishtaDashboard.tsx using regex fallback');
    } else {
        console.log('Block could not be located.');
    }
}
