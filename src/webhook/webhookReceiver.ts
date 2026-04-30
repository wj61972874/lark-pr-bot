import crypto from 'crypto';

export class WebhookReceiver {
  static verifySignature(rawBody: Buffer, signature: string, secret: string): boolean {
    if (!signature.startsWith('sha256=')) return false;
    const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
    const actual = signature.slice('sha256='.length);
    try {
      return crypto.timingSafeEqual(
        Buffer.from(expected, 'hex'),
        Buffer.from(actual, 'hex'),
      );
    } catch {
      return false;
    }
  }
}
