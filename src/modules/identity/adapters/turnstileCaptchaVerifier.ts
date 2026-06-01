import { verifyTurnstileToken } from '@/shared/lib/turnstile';
import type { CaptchaVerifier, CaptchaVerifyResult } from '../ports/captchaVerifier';

export class TurnstileCaptchaVerifier implements CaptchaVerifier {
  async verify(
    token: string | null | undefined,
    remoteIp?: string,
  ): Promise<CaptchaVerifyResult> {
    return verifyTurnstileToken(token, { remoteIp });
  }
}
