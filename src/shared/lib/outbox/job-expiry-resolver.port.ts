import { createToken } from '@/shared/container';
import type { EmailMessage } from '@/shared/lib/email/email-sender.port';

/**
 * Hidratador do payload leve `{kind:'JOB_EXPIRY_D3', jobId}` (USP-044). `shared`
 * não importa `@/modules/jobs` diretamente (regra de camadas — TD §2.5); o
 * dispatcher resolve este token via `container` (padrão despacho-por-tipo,
 * precedente `dispatching-content-status-repository.ts`), e `jobs` registra o
 * adapter real. Retorna `null` = no-op gracioso (vaga/responsável ausente).
 */
export type JobExpiryEmailResolver = (jobId: string) => Promise<EmailMessage | null>;

export const JOB_EXPIRY_EMAIL_RESOLVER_TOKEN = createToken<JobExpiryEmailResolver>(
  'JobExpiryEmailResolver',
);
