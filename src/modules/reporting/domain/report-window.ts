import { isValid, parseISO } from 'date-fns';
import { fromZonedTime } from 'date-fns-tz';
import { APP_TIME_ZONE } from '@/shared/lib/time';

/**
 * Janela de período de um relatório, já resolvida para instantes UTC prontos
 * para um `where` Prisma (`gte`/`lt`) — E-001 (filtro por período) / E-005
 * (janela longa: pré-agregação/`take`, **sem recusa de tamanho** no MVP).
 *
 * `gte`/`lt` `null` = fronteira aberta (sem filtro naquele lado). Boundary
 * **exclusiva** em `lt` (início do dia seguinte a `to`, em America/Sao_Paulo)
 * para cobrir o dia `to` inteiro sem depender de milissegundo de "fim do dia".
 */
export interface ReportWindow {
  gte: Date | null;
  lt: Date | null;
}

/** Entrada crua de filtro de período — datas de calendário `yyyy-MM-dd` (ou vazio). */
export interface ReportWindowInput {
  from?: string | null;
  to?: string | null;
}

/**
 * Converte uma data de calendário `yyyy-MM-dd` (interpretada como meia-noite
 * em America/Sao_Paulo) para o instante UTC correspondente. Retorna `null`
 * para entrada ausente/vazia/inválida — nunca lança (janela mal-formada vira
 * fronteira aberta, não erro 500).
 */
function saoPauloMidnightUtc(day: string | null | undefined): Date | null {
  if (!day) return null;
  const parsed = parseISO(day);
  if (!isValid(parsed)) return null;
  return fromZonedTime(`${day}T00:00:00.000`, APP_TIME_ZONE);
}

/**
 * Resolve a janela de período do relatório (E-001/E-005). `from`/`to`
 * ausentes ⇒ fronteira aberta daquele lado (relatório "desde sempre" /
 * "até agora"). Janela **invertida** (`from` depois de `to`) não é
 * rejeitada (E-005 — sem recusa por tamanho/forma no MVP): o `lt` resultante
 * fica anterior ao `gte`, e a query downstream (`where: { gte, lt }`)
 * naturalmente não casa nenhuma linha — lista vazia, não erro (mesma
 * semântica de "período sem dados" do epic spec).
 */
export function resolveReportWindow(input: ReportWindowInput): ReportWindow {
  const gte = saoPauloMidnightUtc(input.from ?? null);
  const toStart = saoPauloMidnightUtc(input.to ?? null);
  const lt = toStart === null ? null : addOneUtcDay(toStart);
  return { gte, lt };
}

function addOneUtcDay(date: Date): Date {
  const next = new Date(date.getTime());
  next.setUTCDate(next.getUTCDate() + 1);
  return next;
}
