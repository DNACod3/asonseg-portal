import { describe, it, expect } from 'vitest';
import { toCsv, composeWatermark, WATERMARK_PII, type CsvColumn } from '../domain/csv';

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
