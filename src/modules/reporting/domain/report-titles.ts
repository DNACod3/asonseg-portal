import type { ReportType } from '../schemas/export-report';

/**
 * Rótulos PT-BR dos 6 relatórios (R1..R6), compartilhados entre a Server
 * Action `exportReport` (CSV/PDF) e a rota `(app)/relatorios/[tipo]` — vive
 * fora de `actions/export-report.tsx` porque um arquivo `'use server'` só
 * pode exportar funções async (lição USP-041/T5 — `access-report-roles.ts`).
 */
export const REPORT_TITLES: Record<ReportType, string> = {
  jobs: 'Relatório de vagas (MP4)',
  applications: 'Relatório de candidaturas (MP6)',
  services: 'Relatório de serviços e manifestações (MP5/MP7)',
  referrals: 'Relatório de encaminhamentos (MP8/MP9)',
  moderation_queue: 'Relatório de fila de moderação (MP10/MP3)',
  social: 'Relatório social por região',
};
