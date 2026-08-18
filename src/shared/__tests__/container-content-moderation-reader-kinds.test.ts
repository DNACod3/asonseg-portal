import { describe, it, expect } from 'vitest';
import { container } from '@/shared/container';
import {
  CONTENT_MODERATION_READER_TOKEN,
  CONTENT_KINDS_WITH_READER,
  DispatchingContentModerationReader,
  ContentKind,
} from '@/modules/moderation';
// Deep imports justificados (mesmo carve-out documentado em `shared/container.ts`
// e coberto por `no-deep-module-imports.test.ts`, que ignora `__tests__/`): este
// guard precisa comparar a IDENTIDADE do adapter realmente registrado no
// container de produção contra a classe concreta de cada módulo dono — não dá
// para fazer isso via barrel sem reimportar o próprio `container.ts`.
// eslint-disable-next-line no-restricted-imports
import { PrismaJobModerationReader } from '@/modules/jobs/adapters/prisma-job-moderation-reader';
// eslint-disable-next-line no-restricted-imports
import { PrismaServiceModerationReader } from '@/modules/services/adapters/prisma-service-moderation-reader';
// eslint-disable-next-line no-restricted-imports
import { PrismaCandidateProfileModerationReader } from '@/modules/persons/adapters/prisma-candidate-profile-moderation-reader';

/**
 * L-024 (USP-066 / A2 PR#294) + C3 (PR#294 rodada 2): antes desta suíte, a
 * sincronia entre `CONTENT_KINDS_WITH_READER`
 * (moderation/domain/content-moderation-reader-kinds.ts — usada por
 * `moderation-queue.tsx` para decidir quais kinds exigem "conteúdo carregado"
 * antes de habilitar Aprovar, P-001) e o mapa de readers realmente registrado
 * no container era garantida só por comentário; a 1ª versão deste teste
 * fechou a sincronia de CHAVES, mas via `(reader as unknown as { byKind })` —
 * introspecção de campo privado (quebra em runtime, não em compile, num
 * rename) — e não fechava a sincronia de VALORES: trocar
 * `new PrismaServiceModerationReader()` por `new PrismaJobModerationReader()`
 * na entrada de `JOB` passava verde (mesma chave, adapter errado).
 *
 * Este teste amarra as duas fontes por API pública
 * (`DispatchingContentModerationReader#supportedKinds()`/`#readerFor()`, não
 * `byKind`): as chaves com reader real têm que ser EXATAMENTE
 * `CONTENT_KINDS_WITH_READER` (nem mais, nem menos) — e cada chave tem que
 * apontar para a CLASSE certa (identidade do adapter, não só a chave).
 */
describe('container: readers de moderação registrados == CONTENT_KINDS_WITH_READER (L-024/C3)', () => {
  it('as chaves com reader real do dispatcher de produção são exatamente CONTENT_KINDS_WITH_READER', () => {
    const reader = container.resolve(CONTENT_MODERATION_READER_TOKEN);
    expect(reader).toBeInstanceOf(DispatchingContentModerationReader);

    const registeredKinds = [...reader.supportedKinds()].sort();
    expect(registeredKinds).toEqual([...CONTENT_KINDS_WITH_READER].sort());
  });

  it('cada kind aponta para a classe concreta certa (identidade, não só a chave — C3/PR#294 rodada 2)', () => {
    const reader = container.resolve(CONTENT_MODERATION_READER_TOKEN);

    expect(reader.readerFor(ContentKind.JOB)).toBeInstanceOf(PrismaJobModerationReader);
    expect(reader.readerFor(ContentKind.SERVICE)).toBeInstanceOf(PrismaServiceModerationReader);
    expect(reader.readerFor(ContentKind.CANDIDATE_PROFILE)).toBeInstanceOf(
      PrismaCandidateProfileModerationReader,
    );
    // `CV` fica sem reader de propósito (premissa §6 da spec) — explícito, não omitido.
    expect(reader.readerFor(ContentKind.CV)).toBeNull();
  });
});
