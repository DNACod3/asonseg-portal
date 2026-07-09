import { formatSaoPaulo } from '@/shared/lib/time';

/**
 * Serializer CSV puro (RFC-4180) + injeção de watermark LGPD (E-002 /
 * REL42-MN-01). Sem dependência externa (ADR — CSV é o formato "grátis":
 * nenhuma lib nova, ao contrário do PDF/`@react-pdf/renderer`).
 *
 * Delimitador `;` (compatível com a localização PT-BR do Excel — o mesmo
 * arquivo aberto com vírgula quebraria decimais/BR). Quebra de linha `\r\n`
 * (RFC-4180 §2.1).
 */

const DELIMITER = ';';
const LINE_BREAK = '\r\n';

/** Uma coluna do CSV: `key` indexa a linha, `label` é o cabeçalho exibido. */
export interface CsvColumn<T> {
  key: keyof T & string;
  label: string;
}

export interface ToCsvOptions {
  /** Quando presente, vira a 1ª linha do arquivo — antes do cabeçalho (REL42-MN-01). */
  watermark?: string;
}

/**
 * Escapa um campo conforme RFC-4180: campos contendo o delimitador, aspas
 * duplas ou quebra de linha são envolvidos em aspas duplas, com toda aspas
 * dupla interna duplicada (`"` → `""`).
 */
function escapeCsvField(raw: string): string {
  const needsQuoting = raw.includes(DELIMITER) || raw.includes('"') || raw.includes('\n') || raw.includes('\r');
  if (!needsQuoting) return raw;
  return `"${raw.replaceAll('"', '""')}"`;
}

/**
 * `null`/`undefined` viram célula vazia; `Date` vira ISO; primitivos via
 * `String(...)`; objeto residual (não deveria ocorrer — as queries projetam
 * primitivos) vira `JSON.stringify` em vez do `[object Object]` padrão.
 * Exportada para reuso pelo documento PDF (T11 — `report-pdf.tsx`), que
 * precisa do mesmo formato de célula sem duplicar a regra.
 */
export function cellToString(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

/**
 * Serializa `rows` em CSV RFC-4180 usando `columns` (ordem e cabeçalho
 * explícitos — nunca `Object.keys` cru, para não vazar campo não-previsto).
 * `rows=[]` produz só o cabeçalho (+ watermark se pedido), sem lançar —
 * "período sem dados" do epic spec.
 */
export function toCsv<T extends object>(
  rows: readonly T[],
  columns: readonly CsvColumn<T>[],
  opts: ToCsvOptions = {},
): string {
  const lines: string[] = [];

  if (opts.watermark) {
    lines.push(opts.watermark);
  }

  lines.push(columns.map((c) => escapeCsvField(c.label)).join(DELIMITER));

  for (const row of rows) {
    lines.push(columns.map((c) => escapeCsvField(cellToString(row[c.key]))).join(DELIMITER));
  }

  return lines.join(LINE_BREAK);
}

/** Cabeçalho fixo de watermark LGPD (REL42-MN-01 / E-002) — texto verbatim exigido. */
export const WATERMARK_PII = 'Dados pessoais — uso restrito conforme LGPD';

/**
 * Compõe o watermark completo com quem exportou e quando (America/Sao_Paulo)
 * — usado tanto no CSV (1ª linha) quanto no cabeçalho do PDF (T11).
 */
export function composeWatermark(exportedByName: string, exportedAt: Date): string {
  return `${WATERMARK_PII} — exportado por ${exportedByName} em ${formatSaoPaulo(exportedAt)}`;
}
