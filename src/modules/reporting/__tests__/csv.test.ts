import { describe, it, expect } from 'vitest';
import { toCsv, cellToString, composeWatermark, WATERMARK_PII, type CsvColumn } from '../domain/csv';

interface Row {
  name: string;
  qty: number;
  note: string | null;
}

const columns: CsvColumn<Row>[] = [
  { key: 'name', label: 'Nome' },
  { key: 'qty', label: 'Qtd' },
  { key: 'note', label: 'Observação' },
];

describe('toCsv', () => {
  it('cabeçalho + linhas, delimitador ; e quebra CRLF', () => {
    const csv = toCsv<Row>([{ name: 'Vaga A', qty: 3, note: null }], columns);
    const lines = csv.split('\r\n');
    expect(lines[0]).toBe('Nome;Qtd;Observação');
    expect(lines[1]).toBe('Vaga A;3;');
  });

  it('período vazio (rows=[]) → só cabeçalho, sem lançar', () => {
    expect(() => toCsv<Row>([], columns)).not.toThrow();
    const csv = toCsv<Row>([], columns);
    expect(csv).toBe('Nome;Qtd;Observação');
  });

  it('RFC-4180: célula com aspas duplas é escapada (duplicada + envolvida em aspas)', () => {
    const csv = toCsv<Row>([{ name: 'Vaga "Top"', qty: 1, note: null }], columns);
    expect(csv).toContain('"Vaga ""Top"""');
  });

  it('RFC-4180: célula com o delimitador (;) é envolvida em aspas', () => {
    const csv = toCsv<Row>([{ name: 'Vaga; especial', qty: 1, note: null }], columns);
    expect(csv).toContain('"Vaga; especial"');
  });

  it('RFC-4180: célula com quebra de linha é envolvida em aspas', () => {
    const csv = toCsv<Row>([{ name: 'Vaga', qty: 1, note: 'linha1\nlinha2' }], columns);
    expect(csv).toContain('"linha1\nlinha2"');
  });

  it('REL42-MN-01 (negativo): com watermark, a 1ª linha do arquivo é EXATAMENTE o watermark — mutação que a remove fica vermelha', () => {
    const watermark = composeWatermark('Ana Coordenadora', new Date('2026-06-01T12:00:00Z'));
    const csv = toCsv<Row>([{ name: 'Vaga A', qty: 3, note: null }], columns, { watermark });
    const lines = csv.split('\r\n');
    expect(lines[0]).toBe(watermark);
    expect(lines[0]).toContain(WATERMARK_PII);
    // cabeçalho vem DEPOIS do watermark, não substituído por ele.
    expect(lines[1]).toBe('Nome;Qtd;Observação');
  });

  it('sem watermark (relatório agregado sem PII) → 1ª linha é o cabeçalho, não um watermark', () => {
    const csv = toCsv<Row>([], columns);
    expect(csv.split('\r\n')[0]).toBe('Nome;Qtd;Observação');
    expect(csv).not.toContain(WATERMARK_PII);
  });

  it('composeWatermark inclui o texto fixo LGPD + quem exportou + quando', () => {
    const watermark = composeWatermark('Ana Coordenadora', new Date('2026-06-01T12:00:00Z'));
    expect(watermark).toContain(WATERMARK_PII);
    expect(watermark).toContain('Ana Coordenadora');
    expect(watermark).toContain('exportado por');
  });
});

describe('CWE-1236 — neutralização de injeção de fórmula CSV (OWASP CSV Injection)', () => {
  it.each([
    ['=SUM(A1)', "'=SUM(A1)"],
    ['+1', "'+1"],
    ['-cmd', "'-cmd"],
    ['@x', "'@x"],
    ['\tconteudo', "'\tconteudo"],
    ['\rconteudo', "'\rconteudo"],
  ])('cellToString neutraliza célula string começando com gatilho de fórmula: %s', (raw, expected) => {
    expect(cellToString(raw)).toBe(expected);
  });

  it('cellToString não altera string que não começa com gatilho de fórmula', () => {
    expect(cellToString('Vaga A')).toBe('Vaga A');
    expect(cellToString('candidato@empresa.com')).toBe('candidato@empresa.com'); // @ não é o 1º char
  });

  it('cellToString NÃO neutraliza número (mesmo negativo) — só células genuinamente string', () => {
    expect(cellToString(-5)).toBe('-5');
    expect(cellToString(0)).toBe('0');
    expect(cellToString(42)).toBe('42');
  });

  it('cellToString não altera enum/UUID típicos das linhas de relatório', () => {
    expect(cellToString('PUBLICADA')).toBe('PUBLICADA');
    expect(cellToString('3f2504e0-4f89-11d3-9a0c-0305e82c3301')).toBe('3f2504e0-4f89-11d3-9a0c-0305e82c3301');
  });

  it('toCsv: célula string com "=SUM(A1)" sai neutralizada e ainda parseável como RFC-4180 válido', () => {
    const csv = toCsv<Row>([{ name: '=SUM(A1)', qty: 1, note: null }], columns);
    const lines = csv.split('\r\n');
    expect(lines[1]).toBe("'=SUM(A1);1;");
  });

  it('toCsv: célula string começando com TAB sai neutralizada dentro do CSV final', () => {
    const csv = toCsv<Row>([{ name: 'Vaga', qty: 1, note: '\tformula' }], columns);
    expect(csv).toContain("'\tformula");
  });

  it('toCsv: célula numérica (qty) nunca é prefixada com aspas simples, mesmo com valores no limite', () => {
    const csv = toCsv<Row>([{ name: 'Vaga', qty: 0, note: null }], columns);
    const lines = csv.split('\r\n');
    expect(lines[1]).toBe('Vaga;0;');
  });
});
