import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';
import { APP_TIME_ZONE } from '@/shared/lib/time';

/**
 * Rate limit de upload de CV (USP-040 / CVE-07): 3 uploads válidos por
 * candidato por dia-calendário em `America/Sao_Paulo`. Regra pura, sem IO —
 * a contagem real (`CvUploadAttempt`) é lida pela Server Action.
 */
export const DAILY_CV_UPLOAD_LIMIT = 3;

/**
 * Início do dia-calendário em São Paulo, como instante UTC real (não o truque
 * de "meia-noite UTC" usado para colunas `@db.Date` — aqui comparamos contra
 * `createdAt` `@db.Timestamptz`, então precisamos do instante verdadeiro em
 * que o dia local começou).
 */
export function startOfDaySaoPaulo(now: Date): Date {
  const ymd = formatInTimeZone(now, APP_TIME_ZONE, 'yyyy-MM-dd');
  return fromZonedTime(`${ymd}T00:00:00.000`, APP_TIME_ZONE);
}

/** `true` se `count` já atingiu (ou excedeu) {@link DAILY_CV_UPLOAD_LIMIT} — bloqueia o próximo upload. */
export function isOverDailyLimit(count: number): boolean {
  return count >= DAILY_CV_UPLOAD_LIMIT;
}
