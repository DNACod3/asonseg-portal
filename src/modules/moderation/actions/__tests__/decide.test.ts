// Server Actions de decisão (#123) — orquestração Zod → requirePermission → transitionContent.
// Casos obrigatórios (project-guideline §12): happy · validação Zod · permissão negada.
// Dependências de IO/sessão são mockadas — a lógica testada é o encadeamento e o gating.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ok, fail } from '@/shared/errors';

const requirePermission = vi.fn();
const transitionContent = vi.fn();

vi.mock('@/modules/identity', () => ({ requirePermission: (...a: unknown[]) => requirePermission(...a) }));
vi.mock('../transition-content', () => ({
  transitionContent: (...a: unknown[]) => transitionContent(...a),
}));

import { ContentKind, ContentStatus } from '../../domain/content-status';
import { approveContent, returnForAdjustments, rejectContent } from '../decide';

const CONTENT_ID = '00000000-0000-0000-0000-000000000010';
const ref = { contentKind: ContentKind.JOB, contentId: CONTENT_ID };
const MOTIVO = 'Faltou descrever as atividades exercidas no cargo anterior';
const person = { id: 'mod-1' };

beforeEach(() => {
  requirePermission.mockReset();
  transitionContent.mockReset();
  requirePermission.mockResolvedValue(ok({ person }));
  transitionContent.mockResolvedValue(ok({ from: ContentStatus.IN_MODERATION, to: ContentStatus.ACTIVE }));
});

describe('USP-016 #123 — approveContent (E-002)', () => {
  it('happy: valida, checa MODERATE_JOB e delega a transitionContent(to=ACTIVE)', async () => {
    const res = await approveContent(ref);
    expect(res.ok).toBe(true);
    expect(requirePermission).toHaveBeenCalledWith('MODERATE_JOB');
    expect(transitionContent).toHaveBeenCalledWith(
      expect.objectContaining({ to: ContentStatus.ACTIVE, trigger: 'MODERATOR_ACTION', actorPersonId: 'mod-1' }),
    );
  });

  it('P-007: permissão negada retorna FORBIDDEN sem transitar', async () => {
    requirePermission.mockResolvedValue(fail('FORBIDDEN', 'sem permissão'));
    const res = await approveContent(ref);
    expect(res).toMatchObject({ ok: false, error: { code: 'FORBIDDEN' } });
    expect(transitionContent).not.toHaveBeenCalled();
  });

  it('valida o tipo: CV → MODERATE_CV, SERVICE → MODERATE_SERVICE', async () => {
    await approveContent({ contentKind: ContentKind.CV, contentId: CONTENT_ID });
    expect(requirePermission).toHaveBeenCalledWith('MODERATE_CV');
    await approveContent({ contentKind: ContentKind.SERVICE, contentId: CONTENT_ID });
    expect(requirePermission).toHaveBeenCalledWith('MODERATE_SERVICE');
  });

  it('Zod: contentId inválido retorna VALIDATION sem checar permissão', async () => {
    const res = await approveContent({ contentKind: ContentKind.JOB, contentId: 'nope' });
    expect(res).toMatchObject({ ok: false, error: { code: 'VALIDATION' } });
    expect(requirePermission).not.toHaveBeenCalled();
  });
});

describe('USP-016 #123 — returnForAdjustments (E-003) e rejectContent (E-004)', () => {
  it('devolver happy: delega a transitionContent(to=AWAITING_ADJUSTMENTS) com motivo', async () => {
    await returnForAdjustments({ ...ref, justification: MOTIVO });
    expect(transitionContent).toHaveBeenCalledWith(
      expect.objectContaining({ to: ContentStatus.AWAITING_ADJUSTMENTS, justification: MOTIVO }),
    );
  });

  it('rejeitar happy: delega a transitionContent(to=REJECTED) com motivo', async () => {
    await rejectContent({ ...ref, justification: MOTIVO });
    expect(transitionContent).toHaveBeenCalledWith(
      expect.objectContaining({ to: ContentStatus.REJECTED, justification: MOTIVO }),
    );
  });

  it.each(['', 'x', 'ok', 'ajustar'])(
    'P-003: motivo insignificante "%s" retorna VALIDATION sem transitar',
    async (motivo) => {
      const res = await returnForAdjustments({ ...ref, justification: motivo });
      expect(res).toMatchObject({ ok: false, error: { code: 'VALIDATION' } });
      expect(transitionContent).not.toHaveBeenCalled();
    },
  );

  it('P-007: devolver/rejeitar sem permissão retorna FORBIDDEN sem transitar', async () => {
    requirePermission.mockResolvedValue(fail('FORBIDDEN', 'sem permissão'));

    const ret = await returnForAdjustments({ ...ref, justification: MOTIVO });
    expect(ret).toMatchObject({ ok: false, error: { code: 'FORBIDDEN' } });

    const rej = await rejectContent({ ...ref, justification: MOTIVO });
    expect(rej).toMatchObject({ ok: false, error: { code: 'FORBIDDEN' } });

    expect(transitionContent).not.toHaveBeenCalled();
  });

  it('Zod: rejeitar com contentId inválido retorna VALIDATION sem checar permissão', async () => {
    const res = await rejectContent({ contentKind: ContentKind.JOB, contentId: 'nope', justification: MOTIVO });
    expect(res).toMatchObject({ ok: false, error: { code: 'VALIDATION' } });
    expect(requirePermission).not.toHaveBeenCalled();
  });
});
