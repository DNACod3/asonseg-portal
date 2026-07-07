// Server Action inactivateContent (#USP-018) — orquestração Zod → requirePermission → transitionContent.
// Casos obrigatórios (project-guideline §12): happy · validação Zod · permissão negada (INACT-MN-03).
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
import { inactivateContent } from '../inactivate';

const CONTENT_ID = '00000000-0000-0000-0000-000000000010';
const MOTIVO = 'Vaga enganosa, empresa não localizada no endereço informado';
const ref = { contentKind: ContentKind.JOB, contentId: CONTENT_ID, justification: MOTIVO };
const person = { id: 'coord-1' };

beforeEach(() => {
  requirePermission.mockReset();
  transitionContent.mockReset();
  requirePermission.mockResolvedValue(ok({ person }));
  transitionContent.mockResolvedValue(ok({ from: ContentStatus.ACTIVE, to: ContentStatus.INACTIVATED }));
});

describe('USP-018 — inactivateContent (INACT-01/INACT-03/INACT-04/INACT-08)', () => {
  it('happy: valida, checa INACTIVATE_PUBLISHED_CONTENT e delega a transitionContent(to=INACTIVATED)', async () => {
    const res = await inactivateContent(ref);
    expect(res.ok).toBe(true);
    expect(requirePermission).toHaveBeenCalledWith('INACTIVATE_PUBLISHED_CONTENT');
    expect(transitionContent).toHaveBeenCalledWith({
      contentKind: ContentKind.JOB,
      contentId: CONTENT_ID,
      to: ContentStatus.INACTIVATED,
      trigger: 'COORDINATOR_INACTIVATION',
      justification: MOTIVO,
      actorPersonId: 'coord-1',
    });
  });

  it('INACT-MN-03: permissão negada retorna FORBIDDEN sem transitar (nenhuma chamada a transitionContent)', async () => {
    requirePermission.mockResolvedValue(fail('FORBIDDEN', 'sem permissão'));
    const res = await inactivateContent(ref);
    expect(res).toMatchObject({ ok: false, error: { code: 'FORBIDDEN' } });
    expect(transitionContent).not.toHaveBeenCalled();
  });

  it.each(['', 'x', 'ok', '   '])(
    'INACT-02/INACT-MN-02: motivo insignificante "%s" retorna VALIDATION sem checar permissão nem transitar',
    async (motivo) => {
      const res = await inactivateContent({ ...ref, justification: motivo });
      expect(res).toMatchObject({ ok: false, error: { code: 'VALIDATION' } });
      expect(requirePermission).not.toHaveBeenCalled();
      expect(transitionContent).not.toHaveBeenCalled();
    },
  );

  it('Zod: contentId inválido retorna VALIDATION sem checar permissão', async () => {
    const res = await inactivateContent({ contentKind: ContentKind.JOB, contentId: 'nope', justification: MOTIVO });
    expect(res).toMatchObject({ ok: false, error: { code: 'VALIDATION' } });
    expect(requirePermission).not.toHaveBeenCalled();
  });

  it('INACT-08: aceita CANDIDATE_PROFILE (genérico por ContentKind) sem lógica específica de tipo', async () => {
    const res = await inactivateContent({
      contentKind: ContentKind.CANDIDATE_PROFILE,
      contentId: CONTENT_ID,
      justification: MOTIVO,
    });
    expect(res.ok).toBe(true);
    expect(transitionContent).toHaveBeenCalledWith(
      expect.objectContaining({ contentKind: ContentKind.CANDIDATE_PROFILE }),
    );
  });
});
