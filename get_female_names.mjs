import fs from 'fs';
import admin from 'firebase-admin';

// Read .env.local from workspace root
const env = fs.readFileSync('d:\\BohraShaadi\\dbohranisbat\\.env.local', 'utf8');
const lines = env.split('\n');
const envVars = {};
lines.forEach(line => {
    const parts = line.split('=');
    if (parts.length >= 2) {
        const key = parts[0].trim();
        const value = parts.slice(1).join('=').trim().replace(/^['"]|['"]$/g, '');
        envVars[key] = value;
    }
});

const projectId = envVars.FIREBASE_PROJECT_ID || envVars.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
const clientEmail = envVars.FIREBASE_CLIENT_EMAIL;
const privateKey = envVars.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

if (!projectId || !clientEmail || !privateKey) {
    console.error("Missing credentials", { projectId, clientEmail, hasKey: !!privateKey });
    process.exit(1);
}

admin.initializeApp({
    credential: admin.credential.cert({
        projectId,
        clientEmail,
        privateKey,
    })
});

const db = admin.firestore();
const snap = await db.collection('users')
    .where('gender', '==', 'female')
    .where('isItsVerified', '==', true)
    .limit(5)
    .get();

const profiles = [];
snap.forEach(doc => {
    const data = doc.data();
    if (data.name) {
        profiles.push({
            name: data.name.split(' ')[0],
            location: data.city || data.location || data.jamaat || 'Mumbai'
        });
    }
});

console.log(JSON.stringify(profiles));
process.exit(0);
