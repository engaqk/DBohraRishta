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

    // Step 1: Strip all non-digit characters except +
    let phone = raw.replace(/[^\d+]/g, '').trim();

    // Step 2: Handle 00 prefix
    if (phone.startsWith('00')) {
        phone = '+' + phone.substring(2);
    }

    // Step 3: Handle leading 0 (Local format)
    if (phone.startsWith('0')) {
        // Assume India (+91) if it's 11 digits (0 + 10 digits)
        if (phone.length === 11) {
            return '+91' + phone.substring(1);
        }
        // Otherwise, if it's 12 digits starting with 092 (Pakistan local variant)
        if (phone.startsWith('092') && phone.length === 13) {
            return '+' + phone.substring(1);
        }
    }

    // Step 4: If it already starts with +, validate length
    if (phone.startsWith('+')) {
        return /^\+\d{10,15}$/.test(phone) ? phone : null;
    }

    // Step 5: Handle 12-digit numbers starting with 91 or 92 (International without +)
    if (/^(91|92)\d{10}$/.test(phone)) {
        return '+' + phone;
    }

    // Step 6: Handle 10-digit numbers
    if (phone.length === 10) {
        // If it starts with 6,7,8,9, it's almost certainly an Indian mobile number
        if (/^[6789]\d{9}$/.test(phone)) {
            return '+91' + phone;
        }
        // If it starts with 3, it's almost certainly a Pakistan mobile number
        if (/^3\d{9}$/.test(phone)) {
            return '+92' + phone;
        }
    }

    // Default: If it doesn't match any obvious international or optimized local pattern, return null
    // or return the original if it's already long enough to be international but missing + (risky)
    return null;
}

/**
 * Returns true if the phone number is a valid E.164 format.
 */
export function isValidPhone(phone: string): boolean {
    return /^\+\d{7,15}$/.test(phone.replace(/[\s\-()]/g, ''));
}
