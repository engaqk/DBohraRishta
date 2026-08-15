import nodemailer from 'nodemailer';
import fs from 'fs';
import path from 'path';

// Read .env.local manually
const envPath = path.resolve('.env.local');
const envContent = fs.readFileSync(envPath, 'utf-8');
const envVars = {};
envContent.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
        envVars[match[1].trim()] = match[2].trim();
    }
});

const GMAIL_USER = envVars['GMAIL_USER'];
const GMAIL_APP_PASSWORD = envVars['GMAIL_APP_PASSWORD'];

if (!GMAIL_USER || !GMAIL_APP_PASSWORD) {
    console.error("GMAIL_USER or GMAIL_APP_PASSWORD not found in .env.local");
    process.exit(1);
}

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: GMAIL_USER,
        pass: GMAIL_APP_PASSWORD,
    },
});

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

const mailOptions = {
    from: '"53DBohraRishta" <' + GMAIL_USER + '>',
    to: "ablqadir16@gmail.com",
    subject: title,
    html: messageHtml,
};

console.log("Sending test email to ablqadir16@gmail.com...");

transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
        console.error("Error sending email:", error);
    } else {
        console.log("Email sent successfully: " + info.response);
    }
});
