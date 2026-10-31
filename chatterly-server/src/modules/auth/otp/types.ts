export interface SendOtpResult {
  success: boolean;
  message?: string;
}

export interface VerifyOtpResult {
  success: boolean;
  phone?: string;
  error?: string;
}

export interface OtpProvider {
  sendOtp(phone: string): Promise<SendOtpResult>;
  verifyOtp(phone: string, code: string, idToken?: string): Promise<VerifyOtpResult>;
}
