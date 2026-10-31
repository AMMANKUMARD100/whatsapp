import { getAuth } from 'firebase-admin/auth';
import type { OtpProvider, SendOtpResult, VerifyOtpResult } from './types';

export class FirebaseOtpProvider implements OtpProvider {
  async sendOtp(_phone: string): Promise<SendOtpResult> {
    // Firebase handles client-side reCAPTCHA / SMS triggering directly in Expo/Web
    return { success: true };
  }

  async verifyOtp(_phone: string, _code: string, idToken?: string): Promise<VerifyOtpResult> {
    if (!idToken) {
      return { success: false, error: 'idToken is required for Firebase verification' };
    }
    try {
      const decoded = await getAuth().verifyIdToken(idToken);
      const phone = decoded.phone_number;
      if (!phone) return { success: false, error: 'Token missing phone number' };
      return { success: true, phone };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  }
}
