import { describe, it, expect } from 'vitest';
import { ContentStatus } from '@/modules/moderation';
import { hojeSaoPaulo } from '@/shared/lib/time';
import { viewCompanyJobRow } from '../views/company-job-row.view';
import type { CompanyJobRow } from '../queries/list-company-jobs';

// FACTS (USP-024 / T5) — badge "expira em N dias" no painel de gestão (E-004/P-003).
// `diasAteExpiracao` em si é coberto em `validade.spec.ts`; aqui cobrimos a regra de
// exibição (janela de 7 dias, só para ACTIVE) sobre a projeção do painel (USP-023/T8).

function baseRow(overrides: Partial<CompanyJobRow> = {}): CompanyJobRow {
  return {
    id: 'job-1',
    title: 'Vaga Teste',
    status: ContentStatus.ACTIVE,
    validUntil: null,
    publishedAt: null,
    lastStatusChangeAt: new Date(),
    ...overrides,
  };
}

/**
 * `days` a partir do dia-calendário de São Paulo (não do relógio local do processo).
 * `diasAteExpiracao` lê `validUntil` como dia-calendário em UTC (espelha a coluna
 * `@db.Date`) — por isso a fixture aqui precisa estar ancorada em `hojeSaoPaulo()`
 * (UTC midnight do dia SP) via `setUTCDate`, e não em `new Date()` bruto, senão o
 * teste herda o mesmo viés de fuso do L-006 perto da virada do dia BRT.
 */
function daysFromNow(days: number): Date {
  const d = hojeSaoPaulo();
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

describe('viewCompanyJobRow — badge de expiração (USP-024 / E-004 / P-003)', () => {
  it('vaga ACTIVE a 3 dias da validade → expiraEmDias = 3 (dentro da janela)', () => {
    const view = viewCompanyJobRow(baseRow({ validUntil: daysFromNow(3) }));
    expect(view.expiraEmDias).toBe(3);
  });

  it('vaga ACTIVE que expira hoje → expiraEmDias = 0', () => {
    const view = viewCompanyJobRow(baseRow({ validUntil: daysFromNow(0) }));
    expect(view.expiraEmDias).toBe(0);
  });

  it('vaga ACTIVE a 30 dias da validade → expiraEmDias = null (fora da janela de aviso)', () => {
    const view = viewCompanyJobRow(baseRow({ validUntil: daysFromNow(30) }));
    expect(view.expiraEmDias).toBeNull();
  });

  it('vaga ACTIVE sem validUntil → expiraEmDias = null', () => {
    const view = viewCompanyJobRow(baseRow({ validUntil: null }));
    expect(view.expiraEmDias).toBeNull();
  });

  it('vaga PAUSED próxima da validade → expiraEmDias = null (badge só para ACTIVE)', () => {
    const view = viewCompanyJobRow(baseRow({ status: ContentStatus.PAUSED, validUntil: daysFromNow(2) }));
    expect(view.expiraEmDias).toBeNull();
  });

  it('vaga ACTIVE já vencida (job não rodou ainda) → expiraEmDias = null (não mostra "expira em -N dias")', () => {
    const view = viewCompanyJobRow(baseRow({ validUntil: daysFromNow(-2) }));
    expect(view.expiraEmDias).toBeNull();
  });
});

// FACTS (USP-054/EMP-2/MOD-3) — ações de ciclo de vida para DRAFT/AWAITING_ADJUSTMENTS
// e o campo `returnReason` no painel do autor.
describe('viewCompanyJobRow — ações de rascunho/aguardando ajustes (USP054-01/02/06)', () => {
  it('USP054-01: DRAFT → canEdit=true, canSubmit=true; demais ações false', () => {
    const view = viewCompanyJobRow(baseRow({ status: ContentStatus.DRAFT }));
    expect(view.actions).toEqual({
      canEdit: true,
      canSubmit: true,
      canPause: false,
      canUnpause: false,
      canArchive: false,
      canExtend: false,
    });
  });

  it('USP054-02: AWAITING_ADJUSTMENTS → canEdit=true, canSubmit=true; demais ações false', () => {
    const view = viewCompanyJobRow(baseRow({ status: ContentStatus.AWAITING_ADJUSTMENTS }));
    expect(view.actions).toEqual({
      canEdit: true,
      canSubmit: true,
      canPause: false,
      canUnpause: false,
      canArchive: false,
      canExtend: false,
    });
  });

  it.each([
    ContentStatus.ARCHIVED,
    ContentStatus.EXPIRED,
    ContentStatus.INACTIVATED,
    ContentStatus.REJECTED,
    ContentStatus.IN_MODERATION,
  ] as const)(
    'USP054-06/E1: %s permanece all-false (sem ressurreição de estado terminal / já em fila)',
    (status) => {
      const view = viewCompanyJobRow(baseRow({ status }));
      expect(view.actions).toEqual({
        canEdit: false,
        canSubmit: false,
        canPause: false,
        canUnpause: false,
        canArchive: false,
        canExtend: false,
      });
    },
  );

  it('ACTIVE/PAUSED preservados (regressão): canSubmit continua false, demais ações intactas', () => {
    expect(viewCompanyJobRow(baseRow({ status: ContentStatus.ACTIVE })).actions).toEqual({
      canEdit: true,
      canPause: true,
      canUnpause: false,
      canArchive: true,
      canExtend: true,
      canSubmit: false,
    });
    expect(viewCompanyJobRow(baseRow({ status: ContentStatus.PAUSED })).actions).toEqual({
      canEdit: true,
      canPause: false,
      canUnpause: true,
      canArchive: true,
      canExtend: false,
      canSubmit: false,
    });
  });
});

describe('viewCompanyJobRow — returnReason (USP-054/MOD-3)', () => {
  it('USP054-07: AWAITING_ADJUSTMENTS com motivo → expõe returnReason', () => {
    const view = viewCompanyJobRow(
      baseRow({ status: ContentStatus.AWAITING_ADJUSTMENTS }),
      'Falta descrever os requisitos da vaga',
    );
    expect(view.returnReason).toBe('Falta descrever os requisitos da vaga');
  });

  it('USP054-E2: AWAITING_ADJUSTMENTS sem registro de motivo (legado) → returnReason=null', () => {
    const view = viewCompanyJobRow(baseRow({ status: ContentStatus.AWAITING_ADJUSTMENTS }), null);
    expect(view.returnReason).toBeNull();
  });

  it('USP054-10: vaga não está em AWAITING_ADJUSTMENTS (ex. ACTIVE) → returnReason=null mesmo se motivo for passado', () => {
    const view = viewCompanyJobRow(baseRow({ status: ContentStatus.ACTIVE }), 'motivo antigo de uma devolução passada');
    expect(view.returnReason).toBeNull();
  });

  it('assinatura retrocompatível: chamar sem o 2º argumento devolve returnReason=null', () => {
    const view = viewCompanyJobRow(baseRow({ status: ContentStatus.AWAITING_ADJUSTMENTS }));
    expect(view.returnReason).toBeNull();
  });
});
