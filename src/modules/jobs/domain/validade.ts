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

/**
 * Dias de calendário até a expiração de uma vaga (USP-024 / E-004 / P-002/P-003), para o
 * badge "expira em N dias" do painel de gestão (USP-023). Mesma regra de fronteira de
 * {@link validadeStatus} — dia-calendário de `validUntil` (coluna `@db.Date`, lida em UTC)
 * menos o dia-calendário de "hoje" em `America/Sao_Paulo` — para que o cálculo do badge e a
 * decisão de expirar (`runJobExpiration`) usem exatamente a mesma fronteira temporal.
 *
 * Pode retornar negativo (vaga já vencida, ainda não materializada pelo job) ou zero
 * (vence hoje) — quem consome decide o que exibir; a função só calcula a diferença.
 */
export function diasAteExpiracao(validUntil: Date, hojeSP: Date): number {
  const vDate = parseISO(formatInTimeZone(validUntil, 'UTC', 'yyyy-MM-dd'));
  const hojeDate = parseISO(formatInTimeZone(hojeSP, APP_TIME_ZONE, 'yyyy-MM-dd'));
  return differenceInCalendarDays(vDate, hojeDate);
}
