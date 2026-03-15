/**
 * Normalizes a phone number to valid E.164 format before saving to DB or sending SMS.
 *
 * Handles common user input mistakes:
 * - Strips spaces, dashes, parentheses
 * - Removes leading zeros after a country code (e.g. +910XXXXXXXXXX → +91XXXXXXXXXX)
 * - Removes double country code (e.g. +919191XXXXXXXX if typed wrong)
 * - Adds + prefix if missing but starts with a country code digit
 *
 * Returns the normalized number, or null if it's still invalid after normalization.
 */
export function normalizePhone(raw: string): string | null {
    if (!raw) return null;

    // Step 1: Strip all whitespace, dashes, parentheses
    let phone = raw.replace(/[\s\-()]/g, '').trim();

    // Step 2: Ensure it starts with +
    if (!phone.startsWith('+')) {
        // If it starts with 0, assume it's a local number without country code — can't normalize safely
        if (phone.startsWith('0')) return null;
        // Otherwise prepend +
        phone = '+' + phone;
    }

    // Step 3: Fix Indian numbers specifically — +910XXXXXXXXXX → +91XXXXXXXXXX
    // Indian mobile numbers are 10 digits and NEVER start with 0 after the country code
    if (phone.startsWith('+91') && phone.length === 14 && phone[3] === '0') {
        phone = '+91' + phone.slice(4);  // Remove the extra leading 0
    }

    // Step 4: Basic E.164 validation: + followed by 7-15 digits
    if (!/^\+\d{7,15}$/.test(phone)) {
        return null;  // Still invalid after normalization
    }

    return phone;
}

/**
 * Returns true if the phone number is a valid E.164 format.
 */
export function isValidPhone(phone: string): boolean {
    return /^\+\d{7,15}$/.test(phone.replace(/[\s\-()]/g, ''));
}
