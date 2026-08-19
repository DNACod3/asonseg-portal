import { ContentStatus as PrismaContentStatus } from '@prisma/client';
import { prisma } from '@/shared/lib/prisma';
import { viewStaffPersonNames } from '@/modules/persons';
import { ContentKind } from '../domain/content-status';
import { CONTENT_KINDS_WITH_READER } from '../domain/content-moderation-reader-kinds';
import type { ModerationQueueItem } from '../views/moderation-queue-item';

/**
 * Kinds que já têm fonte real própria unida nesta query (`jobRows`/
 * `serviceRows`/`candidateProfileRows`) — hoje o mesmo conjunto de
 * {@link CONTENT_KINDS_WITH_READER}, mas a igualdade é coincidência de
 * domínio, não uma regra estrutural nova: reusamos a constante existente em
 * vez de duplicar a lista (fonte única).
 */
const KINDS_WITH_OWN_SOURCE = new Set<ContentKind>(CONTENT_KINDS_WITH_READER);

/** Limite de itens da fila por leitura (paginação obrigatória — L-001). */
const QUEUE_PAGE_SIZE = 100;

/** Linha intermediária antes de resolver o nome do autor (fonte-agnóstica). */
interface QueueRow {
  contentKind: ContentKind;
  contentId: string;
  title: string;
  authorPersonId: string;
  submittedAt: Date;
  companyUnverified?: boolean;
  companyId?: string;
}

/**
 * Fila do coordenador (E-001 / P-005): rascunhos `IN_MODERATION`, do mais antigo
 * para o mais recente, **excluindo** os itens cujo autor é o próprio moderador
 * (conflito de interesse — ADR-0024).
 *
 * GAP-8 / USP-017 / USP-029: as **vagas** (`JOB`) e os **serviços** (`SERVICE`) já
 * têm model real. Vagas são lidas de `jobs` com join à Empresa (`companyUnverified`
 * dispara o painel de verificação — exclusivo de vagas). Serviços são lidos de
 * `services` **sem** `companyUnverified`/`companyId` (verificação de Empresa não se
 * aplica a serviços — USP-029 design §2). `CANDIDATE_PROFILE` (USP-056/MOD-1) lê
 * `candidate_profiles.publication_status` direto (mesmo padrão de `job`/`service`
 * — 1º conteúdo real fora da `_moderation_fixture`). `CV` segue usando o store
 * transitório `_moderation_fixture` (vazio em prod — o CV vive dentro do
 * `CandidateProfile`, sem entidade própria). As 4 fontes são unidas, ordenadas
 * por `submittedAt` e cortadas no limite da página — o contrato do view model
 * permanece.
 */
export async function viewModerationQueue({
  viewerPersonId,
}: {
  viewerPersonId: string;
}): Promise<ModerationQueueItem[]> {
  const [jobRows, serviceRows, fixtureRows, candidateProfileRows] = await Promise.all([
    prisma.job.findMany({
      where: {
        status: PrismaContentStatus.IN_MODERATION,
        authorPersonId: { not: viewerPersonId }, // P-005 — autor ≠ moderador
      },
      select: {
        id: true,
        title: true,
        authorPersonId: true,
        lastStatusChangeAt: true,
        company: { select: { id: true, isVerified: true } },
      },
      orderBy: { lastStatusChangeAt: 'asc' }, // E-001 — mais antigo primeiro
      take: QUEUE_PAGE_SIZE,
    }),
    prisma.service.findMany({
      where: {
        status: PrismaContentStatus.IN_MODERATION,
        authorPersonId: { not: viewerPersonId }, // P-005 — autor ≠ moderador
      },
      select: {
        id: true,
        title: true,
        authorPersonId: true,
        lastStatusChangeAt: true,
      },
      orderBy: { lastStatusChangeAt: 'asc' },
      take: QUEUE_PAGE_SIZE,
    }),
    prisma.moderationFixtureContent.findMany({
      where: {
        status: PrismaContentStatus.IN_MODERATION,
        authorPersonId: { not: viewerPersonId },
      },
      select: { id: true, kind: true, title: true, authorPersonId: true, submittedAt: true },
      orderBy: { submittedAt: 'asc' },
      take: QUEUE_PAGE_SIZE,
    }),
    prisma.candidateProfile.findMany({
      where: {
        publicationStatus: PrismaContentStatus.IN_MODERATION,
        personId: { not: viewerPersonId }, // P-005 / USP056-MN-01 — autor ≠ moderador
      },
      select: { personId: true, headline: true, lastStatusChangeAt: true },
      orderBy: { lastStatusChangeAt: 'asc' }, // E-001 — mais antigo primeiro
      take: QUEUE_PAGE_SIZE,
    }),
  ]);

  const jobItems: QueueRow[] = jobRows.map((j) => ({
    contentKind: ContentKind.JOB,
    contentId: j.id,
    title: j.title,
    authorPersonId: j.authorPersonId,
    // Entrada em IN_MODERATION (lastStatusChangeAt é setado na transição — USP-020).
    submittedAt: j.lastStatusChangeAt,
    companyUnverified: !j.company.isVerified, // E-001 — dispara o painel (USP-017)
    companyId: j.company.id,
  }));

  const serviceItems: QueueRow[] = serviceRows.map((s) => ({
    contentKind: ContentKind.SERVICE,
    contentId: s.id,
    title: s.title,
    authorPersonId: s.authorPersonId,
    // Entrada em IN_MODERATION (lastStatusChangeAt é setado na transição — USP-029).
    submittedAt: s.lastStatusChangeAt,
    // Sem companyUnverified/companyId: verificação de Empresa é exclusiva de vagas.
  }));

  const fixtureItems: QueueRow[] = fixtureRows.map((r) => {
    // C1 (PR#294 rodada 2) — `_moderation_fixture.kind` é coluna `String`
    // livre, sem FK/enum no banco (`prisma/schema.prisma`); o cast abaixo é
    // sempre necessário, mas repassar o valor cru é o que causava o achado:
    // JOB/SERVICE/CANDIDATE_PROFILE já têm fonte PRÓPRIA unida acima
    // (jobRows/serviceRows/candidateProfileRows) — uma linha do FIXTURE que
    // "afirme" ser um desses 3 kinds é sempre um artefato de teste anterior a
    // USP-020/029 (quando o fixture era a única tabela; ver
    // `moderation-queue.int.test.ts`), nunca conteúdo real: seu `id` é da
    // tabela do fixture, não de `jobs`/`services`/`candidate_profiles`. Se
    // repassássemos esse `kind`, `moderation-queue.tsx` concluiria (via
    // `CONTENT_KINDS_WITH_READER`) que há reader real para a linha; o painel
    // abriria, o reader real faria `findFirst({ id: <uuid do fixture>, status:
    // IN_MODERATION })`, NUNCA encontraria a linha (E-006 ⇒ `error`), e
    // "Aprovar" ficaria travado para sempre — o mesmo formato do bug A2, só
    // que fora do kind `CV`. Normalizamos: um `kind` de fixture que colida com
    // um dos 3 kinds já servidos por fonte real cai para `CV` — o único uso
    // legítimo remanescente do fixture (sem reader, sem conteúdo a carregar,
    // gate vacuamente satisfeito, mesmo tratamento já dado a `CV`). Qualquer
    // outro valor (incl. `CV` genuíno, ou lixo fora do enum) passa como está:
    // nenhum desses tem reader em `CONTENT_KINDS_WITH_READER`, então o gate já
    // era (corretamente) vacuamente satisfeito para eles.
    const rawKind = r.kind as ContentKind;
    const contentKind = KINDS_WITH_OWN_SOURCE.has(rawKind) ? ContentKind.CV : rawKind;
    return {
      contentKind,
      contentId: r.id,
      title: r.title,
      authorPersonId: r.authorPersonId,
      submittedAt: r.submittedAt,
    };
  });

  const candidateProfileItems: QueueRow[] = candidateProfileRows.map((c) => ({
    contentKind: ContentKind.CANDIDATE_PROFILE,
    contentId: c.personId,
    title: c.headline ?? 'Perfil de candidato', // MOD-1 — fallback quando não preenchido
    authorPersonId: c.personId, // perfil é auto-submetido pelo titular
    submittedAt: c.lastStatusChangeAt,
  }));

  // Une as fontes, ordena (mais antigo primeiro) e respeita o limite da página.
  const rows = [...jobItems, ...serviceItems, ...fixtureItems, ...candidateProfileItems]
    .sort((a, b) => a.submittedAt.getTime() - b.submittedAt.getTime())
    .slice(0, QUEUE_PAGE_SIZE);

  if (rows.length === 0) return [];

  // Nome do autor via View Model de staff do módulo `persons` (ADR-0010): nunca
  // lemos `Person` direto de outro módulo. O helper resolve tudo numa única
  // consulta (evita N+1) e expõe só `id → nome`, sem dados da ficha social.
  const nameById = await viewStaffPersonNames(rows.map((r) => r.authorPersonId));

  return rows.map((r) => ({
    contentKind: r.contentKind,
    contentId: r.contentId,
    title: r.title,
    authorName: nameById.get(r.authorPersonId) ?? null,
    submittedAt: r.submittedAt,
    companyUnverified: r.companyUnverified,
    companyId: r.companyId,
  }));
}
