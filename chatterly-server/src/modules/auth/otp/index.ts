import { env } from '../../../config/env';
import { FirebaseOtpProvider } from './firebase';
import { TwilioOtpProvider } from './twilio';
import type { OtpProvider } from './types';

export function getOtpProvider(): OtpProvider {
  if (env.OTP_PROVIDER === 'twilio') {
    return new TwilioOtpProvider();
  }
  return new FirebaseOtpProvider();
}
