// Payment Service for M-Pesa and Airtel Money Integration
// This service handles STK Push and payment requests

const MPESA_API_URL = 'https://api.safaricom.co.ke';
const AIRTEL_API_URL = 'https://openapi.airtel.africa';

class PaymentService {
    constructor() {
        this.settings = {};
    }

    setSettings(settings) {
        this.settings = settings;
    }

    formatPhone(phone) {
        let formatted = phone.replace(/[^0-9]/g, '');
        if (formatted.startsWith('0')) {
            formatted = '254' + formatted.slice(1);
        } else if (!formatted.startsWith('254')) {
            formatted = '254' + formatted;
        }
        return formatted;
    }

    // Generate random transaction ID
    generateTransactionId() {
        return 'TX' + Date.now() + Math.random().toString(36).substr(2, 9).toUpperCase();
    }

    // M-Pesa STK Push
    async sendMpesaSTK(phone, amount, accountReference, transactionDesc) {
        if (!this.settings.mpesaConsumerKey || !this.settings.mpesaConsumerSecret) {
            return { success: false, error: 'M-Pesa API credentials not configured' };
        }

        try {
            // Step 1: Get Access Token
            const tokenResponse = await fetch(`${MPESA_API_URL}/oauth/v1/generate?grant_type=client_credentials`, {
                method: 'GET',
                headers: {
                    'Authorization': 'Basic ' + btoa(`${this.settings.mpesaConsumerKey}:${this.settings.mpesaConsumerSecret}`),
                    'Content-Type': 'application/json'
                }
            });

            if (!tokenResponse.ok) {
                throw new Error('Failed to get M-Pesa access token');
            }

            const tokenData = await tokenResponse.json();
            const accessToken = tokenData.access_token;

            // Step 2: Send STK Push
            const timestamp = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);
            const shortcode = this.settings.mpesaShortcode || this.settings.mpesaPaybill;
            const password = btoa(`${shortcode}${this.settings.mpesaConsumerSecret}${timestamp}`);

            const stkRequest = {
                BusinessShortCode: shortcode,
                Password: password,
                Timestamp: timestamp,
                TransactionType: 'CustomerPayBillOnline',
                Amount: Math.ceil(amount),
                PartyA: this.formatPhone(phone),
                PartyB: shortcode,
                PhoneNumber: this.formatPhone(phone),
                CallBackURL: this.settings.mpesaCallbackUrl || '',
                AccountReference: accountReference,
                TransactionDesc: transactionDesc
            };

            const stkResponse = await fetch(`${MPESA_API_URL}/mpesa/stkpush/v1/processrequest`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(stkRequest)
            });

            const stkData = await stkResponse.json();

            if (stkData.ResponseCode === '0') {
                return {
                    success: true,
                    checkoutRequestId: stkData.CheckoutRequestID,
                    merchantRequestId: stkData.MerchantRequestID,
                    message: 'STK push sent successfully'
                };
            } else {
                return {
                    success: false,
                    error: stkData.ResponseDescription || 'STK push failed'
                };
            }

        } catch (error) {
            console.error('M-Pesa Error:', error);
            return {
                success: false,
                error: error.message || 'Failed to send M-Pesa STK'
            };
        }
    }

    // M-Pesa B2C (Send to customer)
    async sendMpesaB2C(phone, amount, occasion) {
        if (!this.settings.mpesaConsumerKey || !this.settings.mpesaConsumerSecret) {
            return { success: false, error: 'M-Pesa API credentials not configured' };
        }

        try {
            const tokenResponse = await fetch(`${MPESA_API_URL}/oauth/v1/generate?grant_type=client_credentials`, {
                method: 'GET',
                headers: {
                    'Authorization': 'Basic ' + btoa(`${this.settings.mpesaConsumerKey}:${this.settings.mpesaConsumerSecret}`),
                    'Content-Type': 'application/json'
                }
            });

            const tokenData = await tokenResponse.json();
            const accessToken = tokenData.access_token;

            const timestamp = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);
            const shortcode = this.settings.mpesaShortcode;
            const password = btoa(`${shortcode}${this.settings.mpesaConsumerSecret}${timestamp}`);

            const b2cRequest = {
                OriginatorConversationID: this.generateTransactionId(),
                ConversationID: '',
                Destination: this.formatPhone(phone),
                Amount: Math.ceil(amount),
                ShortCode: shortcode,
                Remarks: 'School fee payment refund',
                Occasion: occasion || 'Fee Refund'
            };

            const response = await fetch(`${MPESA_API_URL}/mpesa/b2c/v1/paymentrequest`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(b2cRequest)
            });

            const data = await response.json();
            return {
                success: data.ResponseCode === '0',
                conversationId: data.ConversationID,
                message: data.ResponseDescription
            };

        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // Check M-Pesa STK Status
    async checkMpesaStatus(checkoutRequestId) {
        if (!this.settings.mpesaConsumerKey || !this.settings.mpesaConsumerSecret) {
            return { success: false, error: 'M-Pesa API credentials not configured' };
        }

        try {
            const tokenResponse = await fetch(`${MPESA_API_URL}/oauth/v1/generate?grant_type=client_credentials`, {
                method: 'GET',
                headers: {
                    'Authorization': 'Basic ' + btoa(`${this.settings.mpesaConsumerKey}:${this.settings.mpesaConsumerSecret}`),
                    'Content-Type': 'application/json'
                }
            });

            const tokenData = await tokenResponse.json();
            const accessToken = tokenData.access_token;

            const timestamp = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);
            const shortcode = this.settings.mpesaShortcode || this.settings.mpesaPaybill;
            const password = btoa(`${shortcode}${this.settings.mpesaConsumerSecret}${timestamp}`);

            const queryRequest = {
                BusinessShortCode: shortcode,
                Password: password,
                Timestamp: timestamp,
                CheckoutRequestID: checkoutRequestId
            };

            const response = await fetch(`${MPESA_API_URL}/mpesa/stkpushquery/v1/query`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(queryRequest)
            });

            const data = await response.json();
            return {
                success: data.ResponseCode === '0',
                status: data.ResultCode === '0' ? 'SUCCESS' : 'FAILED',
                message: data.ResultDesc
            };

        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // Airtel Money Payment Request
    async sendAirtelRequest(phone, amount, reference, callbackUrl) {
        if (!this.settings.airtelApiKey || !this.settings.airtelApiSecret) {
            return { success: false, error: 'Airtel API credentials not configured' };
        }

        try {
            // Get Airtel Token
            const tokenResponse = await fetch(`${AIRTEL_API_URL}/auth/oauth2/token`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    client_id: this.settings.airtelApiKey,
                    client_secret: this.settings.airtelApiSecret,
                    grant_type: 'client_credentials'
                })
            });

            if (!tokenResponse.ok) {
                throw new Error('Failed to get Airtel access token');
            }

            const tokenData = await tokenResponse.json();
            const accessToken = tokenData.access_token;

            // Send Payment Request
            const paymentRequest = {
                reference: reference,
                subscriber: {
                    country: 'KE',
                    currency: 'KES',
                    msisdn: this.formatPhone(phone)
                },
                transaction: {
                    amount: Math.ceil(amount),
                    country: 'KE',
                    currency: 'KES',
                    description: 'School Fees Payment'
                }
            };

            const response = await fetch(`${AIRTEL_API_URL}/merchant/v1/payments`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                    'X-Country': 'KE',
                    'X-Currency': 'KES'
                },
                body: JSON.stringify(paymentRequest)
            });

            const data = await response.json();

            if (data.status && data.status.code === 'success') {
                return {
                    success: true,
                    transactionId: data.data.transaction_id,
                    message: 'Payment request sent successfully'
                };
            } else {
                return {
                    success: false,
                    error: data.status?.message || 'Airtel payment request failed'
                };
            }

        } catch (error) {
            console.error('Airtel Error:', error);
            return {
                success: false,
                error: error.message || 'Failed to send Airtel request'
            };
        }
    }

    // Check Airtel Payment Status
    async checkAirtelStatus(transactionId) {
        if (!this.settings.airtelApiKey || !this.settings.airtelApiSecret) {
            return { success: false, error: 'Airtel API credentials not configured' };
        }

        try {
            const tokenResponse = await fetch(`${AIRTEL_API_URL}/auth/oauth2/token`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    client_id: this.settings.airtelApiKey,
                    client_secret: this.settings.airtelApiSecret,
                    grant_type: 'client_credentials'
                })
            });

            const tokenData = await tokenResponse.json();
            const accessToken = tokenData.access_token;

            const response = await fetch(`${AIRTEL_API_URL}/merchant/v1/transactions/${transactionId}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'X-Country': 'KE',
                    'X-Currency': 'KES'
                }
            });

            const data = await response.json();
            return {
                success: data.status?.code === 'success',
                status: data.data?.status,
                message: data.status?.message
            };

        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // Unified payment request
    async sendPaymentPrompt(phone, amount, studentName, method, admissionNo) {
        const accountReference = admissionNo || studentName.replace(/\s/g, '');
        const transactionDesc = `School Fees - ${studentName}`;

        if (method === 'mpesa') {
            return this.sendMpesaSTK(phone, amount, accountReference, transactionDesc);
        } else if (method === 'airtel') {
            return this.sendAirtelRequest(phone, amount, accountReference, this.settings.airtelCallbackUrl);
        } else {
            return { success: false, error: 'Invalid payment method' };
        }
    }
}

export const paymentService = new PaymentService();
