import axios from 'axios';
import { normalizePhone } from './phoneUtils';

export interface SMSResponse {
    success: boolean;
    data?: any;
    error?: string;
}

/**
 * Robust Central SMS Service for Textbee Gateway.
 * Supports single and bulk sending with automatic E.164 normalization.
 */
export async function sendSMS(phone: string, message: string): Promise<SMSResponse> {
    const normalized = normalizePhone(phone);
    if (!normalized) {
        return { success: false, error: 'Invalid phone format' };
    }

    const deviceId = process.env.TEXTBEE_DEVICE_ID;
    const apiKey = process.env.TEXTBEE_API_KEY;

    if (!deviceId || !apiKey) {
        return { success: false, error: 'SMS Gateway not configured' };
    }

    try {
        console.log(`[SMS Service] Sending to ${normalized}: "${message.substring(0, 20)}..."`);
        
        const textbeeUrl = `https://api.textbee.dev/api/v1/gateway/devices/${deviceId}/send-sms`;
        const response = await axios.post(
            textbeeUrl,
            {
                recipients: [normalized],
                message: message.trim(),
            },
            {
                headers: {
                    'x-api-key': apiKey,
                    'Content-Type': 'application/json',
                },
                timeout: 30000,
            }
        );

        console.log(`[SMS Service] Success:`, response.data);
        return { success: true, data: response.data };

    } catch (error: any) {
        const errMsg = error.response?.data?.message || error.message || 'Unknown network error';
        console.error(`[SMS Service] Error sending to ${normalized}:`, errMsg);
        
        // Retry with Bulk API as fallback (since it was reported working)
        try {
            console.log(`[SMS Service] Retrying with BULK API for robustness...`);
            const bulkUrl = `https://api.textbee.dev/api/v1/gateway/devices/${deviceId}/send-bulk-sms`;
            const bulkResponse = await axios.post(
                bulkUrl,
                {
                    messages: [{
                        message: message.trim(),
                        recipients: [normalized],
                    }]
                },
                {
                    headers: {
                        'x-api-key': apiKey,
                        'Content-Type': 'application/json',
                    },
                    timeout: 30000,
                }
            );
            console.log(`[SMS Service] Bulk Fallback Success:`, bulkResponse.data);
            return { success: true, data: bulkResponse.data };
        } catch (bulkError: any) {
            const finalMsg = bulkError.response?.data?.message || bulkError.message || 'Bulk fallback failed';
            console.error(`[SMS Service] Final Failure:`, finalMsg);
            return { success: false, error: finalMsg };
        }
    }
}
