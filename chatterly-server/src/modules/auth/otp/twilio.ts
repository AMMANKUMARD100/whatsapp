import twilio from 'twilio';
import { env } from '../../../config/env';
import type { OtpProvider, SendOtpResult, VerifyOtpResult } from './types';

export class TwilioOtpProvider implements OtpProvider {
  private client?: twilio.Twilio;

  private getClient() {
    if (!this.client && env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN) {
      this.client = twilio(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN);
    }
    return this.client;
  }

  async sendOtp(phone: string): Promise<SendOtpResult> {
    const client = this.getClient();
    if (!client || !env.TWILIO_VERIFY_SERVICE_SID) {
      return { success: true }; // dev mock fallback
    }
    try {
      await client.verify.v2.services(env.TWILIO_VERIFY_SERVICE_SID).verifications.create({
        to: phone,
        channel: 'sms',
      });
      return { success: true };
    } catch (err) {
      return { success: false, message: (err as Error).message };
    }
  }

  async verifyOtp(phone: string, code: string): Promise<VerifyOtpResult> {
    const client = this.getClient();
    if (!client || !env.TWILIO_VERIFY_SERVICE_SID) {
      if (code === '123456') return { success: true, phone };
      return { success: false, error: 'Invalid verification code' };
    }
    try {
      const check = await client.verify.v2
        .services(env.TWILIO_VERIFY_SERVICE_SID)
        .verificationChecks.create({ to: phone, code });
      if (check.status === 'approved') return { success: true, phone };
      return { success: false, error: 'Invalid code' };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  }
}
