import { adminDb } from './firebase/admin-config';

export async function isEmailBlocked(email: string): Promise<boolean> {
    if (!adminDb) return false;
    try {
        const emailLower = email.toLowerCase().trim();
        const doc = await adminDb.collection('email_delivery_failures').doc(emailLower).get();
        if (doc.exists) {
            const data = doc.data();
            return (data?.failureCount || 0) >= 2;
        }
    } catch (error) {
        console.error("Error checking email block status:", error);
    }
    return false;
}

export async function recordEmailFailure(email: string, errorMsg?: string): Promise<void> {
    if (!adminDb) return;
    try {
        const emailLower = email.toLowerCase().trim();
        const ref = adminDb.collection('email_delivery_failures').doc(emailLower);
        
        await adminDb.runTransaction(async (transaction) => {
            const doc = await transaction.get(ref);
            if (doc.exists) {
                const currentCount = doc.data()?.failureCount || 0;
                transaction.update(ref, {
                    failureCount: currentCount + 1,
                    lastFailure: new Date(),
                    lastError: errorMsg || 'Unknown Error',
                    updatedAt: new Date()
                });
            } else {
                transaction.set(ref, {
                    email: emailLower,
                    failureCount: 1,
                    lastFailure: new Date(),
                    lastError: errorMsg || 'Unknown Error',
                    createdAt: new Date(),
                    updatedAt: new Date()
                });
            }
        });
        
        console.log(`[EmailStatus] Recorded failure for ${emailLower}.`);
    } catch (error) {
        console.error("Error recording email failure:", error);
    }
}

export async function resetEmailFailures(email: string): Promise<void> {
    if (!adminDb) return;
    try {
        const emailLower = email.toLowerCase().trim();
        await adminDb.collection('email_delivery_failures').doc(emailLower).delete();
        console.log(`[EmailStatus] Reset failures for ${emailLower}.`);
    } catch (error) {
        console.error("Error resetting email failures:", error);
    }
}
