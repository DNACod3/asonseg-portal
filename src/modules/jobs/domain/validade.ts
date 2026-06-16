import { differenceInCalendarDays, parseISO } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import { APP_TIME_ZONE } from '@/shared/lib/time';

/**
 * Teto máximo de validade de uma vaga, em dias (USP-020 / E-005 / P-005 / L-002).
 * Tunável: quando o catálogo D-007 fechar regras de validade por regime, este valor
 * pode virar configuração. Por ora é a barreira contra "validade absurdamente futura".
 */
export const MAX_VALIDADE_DIAS = 180;

export type ValidadeStatus = 'ok' | 'passado' | 'excede_teto';

/**
 * Regra pura de validade de uma vaga (E-004 / E-005 / P-005). Compara **datas de
 * calendário** (não timestamps) no fuso America/Sao_Paulo:
 *
 * - `passado`      → validade ≤ hoje (bloqueia submit — E-004).
 * - `excede_teto`  → validade ultrapassa {@link MAX_VALIDADE_DIAS} dias (E-005 / P-005).
 * - `ok`           → data futura dentro do teto (inclusive a borda exata de 180 dias).
 *
 * `validUntil` é uma data pura (`@db.Date` / `z.coerce.date`), persistida à meia-noite
 * UTC — lê-se seu dia-calendário em UTC para não deslocar o dia. `hojeSP` é um instante
 * real (ex.: `new Date()`); seu dia-calendário é lido em America/Sao_Paulo.
 */
export function validadeStatus(validUntil: Date, hojeSP: Date): ValidadeStatus {
  const vDate = parseISO(formatInTimeZone(validUntil, 'UTC', 'yyyy-MM-dd'));
  const hojeDate = parseISO(formatInTimeZone(hojeSP, APP_TIME_ZONE, 'yyyy-MM-dd'));
  const diffDias = differenceInCalendarDays(vDate, hojeDate);

  if (diffDias <= 0) return 'passado';
  if (diffDias > MAX_VALIDADE_DIAS) return 'excede_teto';
  return 'ok';
}
