import { describe, it, expect } from 'vitest';
import type { ReactElement, ReactNode } from 'react';
import { ReportPdfDocument } from '../components/report-pdf';
import { composeWatermark, WATERMARK_PII } from '../domain/csv';

/**
 * Component test do documento PDF (T11 — REL42-MN-01). `@react-pdf/renderer`
 * não produz DOM (Testing Library/jsdom não se aplica) — o componente é uma
 * função pura que devolve a árvore de elementos React consumida por
 * `renderToBuffer`. Chamamos `ReportPdfDocument(...)` diretamente (sem
 * reconciler, sem PDF real) e inspecionamos `.props.children` recursivamente
 * — o mesmo teste que valida a árvore valida o que `renderToBuffer` vai
 * serializar, sem o custo de gerar bytes de PDF de verdade.
 */
function collectTexts(node: unknown, acc: string[] = []): string[] {
  if (node === null || node === undefined || typeof node === 'boolean') return acc;
  if (typeof node === 'string' || typeof node === 'number') {
    acc.push(String(node));
    return acc;
  }
  if (Array.isArray(node)) {
    for (const child of node) collectTexts(child, acc);
    return acc;
  }
  if (typeof node === 'object' && node !== null && 'props' in node) {
    const el = node as ReactElement<{ children?: ReactNode }>;
    collectTexts(el.props?.children, acc);
    return acc;
  }
  return acc;
}

describe('ReportPdfDocument', () => {
  it('sem watermark (relatório sem PII): nenhum texto contém o aviso LGPD', () => {
    const doc = ReportPdfDocument({
      title: 'Relatório de vagas',
      columns: [{ key: 'status', label: 'Status' }],
      rows: [{ status: 'ACTIVE' }],
    });
    const texts = collectTexts(doc);
    expect(texts.some((t) => t.includes(WATERMARK_PII))).toBe(false);
  });

  it('REL42-MN-01 (negativo): com watermark, o documento inclui o texto LGPD verbatim — mutação que o omite fica vermelha', () => {
    const watermark = composeWatermark('Ana Coordenadora', new Date('2026-06-01T12:00:00Z'));
    const doc = ReportPdfDocument({
      title: 'Relatório social',
      columns: [{ key: 'regionName', label: 'Região' }],
      rows: [{ regionName: 'Centro' }],
      watermark,
    });
    const texts = collectTexts(doc);
    expect(texts.some((t) => t.includes(WATERMARK_PII))).toBe(true);
    expect(texts).toContain(watermark);
  });

  it('rows=[] → aviso "sem dados no período", sem lançar (período vazio do epic spec)', () => {
    const build = () =>
      ReportPdfDocument({ title: 'Vazio', columns: [{ key: 'status', label: 'Status' }], rows: [] });
    expect(build).not.toThrow();
    const texts = collectTexts(build());
    expect(texts.some((t) => t.toLowerCase().includes('sem dados'))).toBe(true);
  });

  it('renderiza título e os rótulos de coluna informados', () => {
    const doc = ReportPdfDocument({
      title: 'Relatório X',
      columns: [
        { key: 'a', label: 'Coluna A' },
        { key: 'b', label: 'Coluna B' },
      ],
      rows: [{ a: '1', b: '2' }],
    });
    const texts = collectTexts(doc);
    expect(texts).toContain('Relatório X');
    expect(texts).toContain('Coluna A');
    expect(texts).toContain('Coluna B');
  });
});
