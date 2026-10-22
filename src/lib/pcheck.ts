import { PCheckSDK } from '@eliabay100-del/pcheck-erp-sdk';

export const pcheck = new PCheckSDK({
  baseUrl: process.env.PCHECK_API_URL || 'https://pcheck.example.com',
  apiToken: process.env.PCHECK_API_TOKEN || '',
  webhookSecret: process.env.PCHECK_WEBHOOK_SECRET,
  timeout: 10000,
  retries: 3,
  retryDelay: 500,
});

export async function verifyPayment(
  reference: string,
  provider: string,
  amount: number,
  currency: string = 'ETB'
): Promise<{ status: 'verified' | 'declined' | 'pending'; data?: any }> {
  try {
    const result = await pcheck.verify({
      transactionId: reference,
      provider,
      amount,
      currency,
    });

    return {
      status: result.status === 'verified' ? 'verified' : result.status === 'failed' ? 'declined' : 'pending',
      data: result,
    };
  } catch (error) {
    console.error('P-Check verification error:', error);
    return { status: 'pending' };
  }
}
