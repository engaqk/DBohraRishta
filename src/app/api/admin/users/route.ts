import { NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebase/admin";

export async function GET() {
    try {
        if (!adminAuth || typeof adminAuth.listUsers !== "function") {
            throw new Error("Firebase Admin Auth is not initialized. Please check your service account credentials.");
        }

        const listUsersResult = await adminAuth.listUsers(1000); // Fetch up to 1000 users
        const users = listUsersResult.users.map(u => ({
            uid: u.uid,
            email: u.email,
            displayName: u.displayName,
            photoURL: u.photoURL,
            phoneNumber: u.phoneNumber,
            creationTime: u.metadata.creationTime,
            lastSignInTime: u.metadata.lastSignInTime,
        }));

        return NextResponse.json({ users });
    } catch (error: any) {
        console.error("Error listing auth users:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
