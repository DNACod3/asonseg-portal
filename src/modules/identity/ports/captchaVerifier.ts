/** Resultado de uma verificação de CAPTCHA. */
export interface CaptchaVerifyResult {
  readonly ok: boolean;
  readonly errorCode?: string;
}

/** Porta para verificação de CAPTCHA server-side (ADR-0014).
 *  Consumidores dependem desta interface, nunca do adapter concreto (Turnstile).
 *  Resolução via container.ts.
 */
export interface CaptchaVerifier {
  verify(token: string | null | undefined, remoteIp?: string): Promise<CaptchaVerifyResult>;
}

import { createToken } from '@/shared/container';

export const CAPTCHA_VERIFIER_TOKEN = createToken<CaptchaVerifier>('CaptchaVerifier');
