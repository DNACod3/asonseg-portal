import { format, parseISO } from 'date-fns';
import { fromZonedTime, toZonedTime, formatInTimeZone } from 'date-fns-tz';

/**
 * Utilitários de tempo (CLAUDE.md): o banco armazena `timestamptz` em UTC;
 * a conversão para/de horário local acontece na borda usando date-fns-tz.
 */
export const APP_TIME_ZONE = 'America/Sao_Paulo' as const;

/** Converte um horário de parede em São Paulo para o instante UTC correspondente. */
export function saoPauloToUtc(localDate: Date | string): Date {
  return fromZonedTime(localDate, APP_TIME_ZONE);
}

/** Converte um instante UTC para o horário de parede em São Paulo. */
export function utcToSaoPaulo(utcDate: Date | string): Date {
  return toZonedTime(utcDate, APP_TIME_ZONE);
}

/** Formata um instante UTC já no fuso de São Paulo. */
export function formatSaoPaulo(
  utcDate: Date | string,
  fmt = "dd/MM/yyyy HH:mm",
): string {
  return formatInTimeZone(utcDate, APP_TIME_ZONE, fmt);
}

/**
 * Data de hoje (sem hora) no fuso de São Paulo, como `Date` em meia-noite UTC do
 * dia-calendário local. Usada no filtro on-read da busca de vagas (USP-021 / E-001 /
 * P-003): `validUntil >= hojeSaoPaulo()`. Como `valid_until` é coluna `date` (Prisma
 * lê/escreve em meia-noite UTC), comparar com este valor compara o dia-calendário —
 * sem o deslocamento que `new Date()` causaria perto da virada do dia.
 */
export function hojeSaoPaulo(): Date {
  const ymd = formatInTimeZone(new Date(), APP_TIME_ZONE, 'yyyy-MM-dd');
  return new Date(`${ymd}T00:00:00.000Z`);
}

/**
 * Formata uma data "pura" (ex.: data de nascimento) sem aplicar fuso.
 * Strings são interpretadas como meia-noite local (parseISO), evitando o
 * deslocamento de dia que `new Date('yyyy-MM-dd')` causa (parse em UTC).
 */
export function formatDate(date: Date | string, fmt = 'dd/MM/yyyy'): string {
  return format(typeof date === 'string' ? parseISO(date) : date, fmt);
}
