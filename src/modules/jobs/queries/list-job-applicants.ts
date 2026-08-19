import { headers } from 'next/headers';
import { Prisma } from '@prisma/client';
import type { CurrentPerson } from '@/modules/identity';
import { AuditEvent, withAudit, recordAuditEvent } from '@/modules/audit';
import { viewCandidateForEmployer, type EmployerCandidateView } from '@/modules/persons';
import { ok, fail, type ActionResult } from '@/shared/errors';
import { clientIp } from '@/shared/lib/clientIp';
import { childLogger } from '@/shared/lib/logger';
import { prisma } from '@/shared/lib/prisma';
import { resolveSignedCvUrl } from '@/shared/lib/supabase/supabase-storage';
import { requireActiveResponsible } from '../server/require-active-responsible';

/** Tamanho de página da lista de candidatos (L-002 — `take` obrigatório). */
export const APPLICANTS_PAGE_SIZE = 20;

export interface EmployerCandidatesResult {
  applicants: EmployerCandidateView[];
  /** Total de candidaturas ATIVAS da vaga (não paginado). */
  total: number;
  page: number;
  pageSize: number;
}

/**
 * `select` explícito (P-002/USP027-MN-01) — carrega **só** a PII permitida ao
 * empregador (nome, e-mail, telefone, CV). `cpf`/`birthDate`/`fullAddress` NUNCA
 * aparecem aqui: é estruturalmente impossível vazá-los no payload Flight/RSC.
 */
const applicantSelect = {
  appliedAt: true,
  viaEncaminhamento: true,
  candidate: {
    select: {
      id: true,
      fullName: true,
      emailLogin: true,
      phone: true,
      candidateProfile: { select: { cvStoragePath: true, cvUploadedAt: true } },
    },
  },
} satisfies Prisma.ApplicationSelect;

/**
 * Lista as candidaturas **ativas** de uma vaga para o responsável da Empresa dona
 * dela (USP-027 / CAN-03). Fonte única do acesso a contato/CV de candidato por uma
 * Empresa — leitura sensível, auditada em toda chamada.
 *
 * Sequência (adaptada da canônica de Server Action sensível — esta é uma leitura,
 * não uma escrita, mas segue o mesmo espírito least-privilege + auditoria):
 *  1. Resolve a vaga (`NOT_FOUND` se inexistente — sem vazar existência).
 *  2. **Ownership**: `requireActiveResponsible` — `FORBIDDEN` **sem** carregar nem
 *     auditar candidato algum (USP027-MN-02).
 *  3. SELECT restrito das candidaturas ativas (`cancelledAt: null`), paginado no
 *     banco (USP027-MN-03 — canceladas nunca entram no `where`).
 *  4. Resolve a URL assinada do CV por candidato (fora da transação — leitura).
 *  5. Mapeia por `viewCandidateForEmployer` (USP027-MN-05 — só View Model sai).
 *  6. Audita: 1 `APPLICATION_VIEWED_BY_EMPLOYER` (entidade=job) + N
 *     `SENSITIVE_FIELD_VIEWED` (entidade=person, um por candidato exibido) na
 *     MESMA transação, sequenciais (guideline §13 — nada de `Promise.all` dentro
 *     de um `tx`). `viewedFields` só inclui `'cv'` quando o candidato tem CV
 *     disponível (edge — não registra acesso a CV inexistente).
 *
 * Nunca lança — sempre `ActionResult`.
 */
export async function listJobApplicants(
  input: { jobId: string; page?: number },
  viewer: CurrentPerson,
): Promise<ActionResult<EmployerCandidatesResult>> {
  const log = childLogger({ module: 'jobs', query: 'listJobApplicants' });

  const job = await prisma.job.findUnique({
    where: { id: input.jobId },
    select: { id: true, companyId: true },
  });
  if (!job) {
    return fail('NOT_FOUND', 'Vaga não encontrada.');
  }

  // USP027-MN-02: ownership checado ANTES de qualquer carga de candidato.
  const authorized = await requireActiveResponsible(viewer.id, job.companyId);
  if (!authorized) {
    return fail('FORBIDDEN', 'Você não é responsável por esta Empresa.');
  }

  const page = Math.max(1, Math.trunc(input.page ?? 1));
  const skip = (page - 1) * APPLICANTS_PAGE_SIZE;
  // USP027-MN-03: candidaturas canceladas nunca entram no `where` (fonte única).
  const where = { jobId: job.id, cancelledAt: null } satisfies Prisma.ApplicationWhereInput;

  const [rows, total] = await Promise.all([
    prisma.application.findMany({
      where,
      orderBy: { appliedAt: 'asc' },
      take: APPLICANTS_PAGE_SIZE,
      skip,
      select: applicantSelect,
    }),
    prisma.application.count({ where }),
  ]);

  // Assinaturas de CV resolvidas em paralelo (P-004): são chamadas independentes
  // ao Storage, fora da transação de auditoria — `Promise.all` mantém a ordem
  // `appliedAt asc` das linhas e evita ~N round-trips seriais por página.
  // `resolveSignedCvUrl` nunca lança (degrada para `null`), então nenhum item derruba os demais.
  const applicants: EmployerCandidateView[] = await Promise.all(
    rows.map(async (row) => {
      const cvStoragePath = row.candidate.candidateProfile?.cvStoragePath ?? null;
      const cvSignedUrl = await resolveSignedCvUrl(cvStoragePath, {
        module: 'jobs',
        query: 'listJobApplicants',
      });
      return viewCandidateForEmployer({
        candidatePersonId: row.candidate.id,
        fullName: row.candidate.fullName,
        emailLogin: row.candidate.emailLogin,
        phone: row.candidate.phone,
        appliedAt: row.appliedAt,
        viaEncaminhamento: row.viaEncaminhamento,
        cvStoragePath,
        cvUploadedAt: row.candidate.candidateProfile?.cvUploadedAt ?? null,
        cvSignedUrl,
      });
    }),
  );

  const hdrs = await headers();
  const rawIp = clientIp(hdrs);
  const ip = rawIp === 'unknown' ? null : rawIp;
  const userAgent = hdrs.get('user-agent') ?? null;
  const ctx = {
    actorPersonId: viewer.id,
    ip,
    userAgent,
    context: { route: `/empresa/${job.companyId}/vagas/${job.id}/candidatos` },
  };

  try {
    await withAudit(
      AuditEvent.APPLICATION_VIEWED_BY_EMPLOYER,
      async (tx, audit) => {
        audit.entityType = 'job';
        audit.entityId = job.id;
        audit.after = { companyId: job.companyId, applicantCount: applicants.length };

        // USP027-MN-04: 1 evento secundário por candidato exibido, na mesma tx.
        for (const applicant of applicants) {
          const viewedFields = ['email', 'phone', ...(applicant.cv.available ? ['cv'] : [])];
          await recordAuditEvent(
            tx,
            AuditEvent.SENSITIVE_FIELD_VIEWED,
            {
              entityType: 'person',
              entityId: applicant.candidatePersonId,
              context: { jobId: job.id, viewedFields },
            },
            ctx,
          );
        }
      },
      ctx,
    );
  } catch (err) {
    log.error({ err, jobId: job.id }, 'jobs:list_job_applicants_audit_failed');
    return fail('INTERNAL', 'Erro interno. Tente novamente mais tarde.');
  }

  return ok({ applicants, total, page, pageSize: APPLICANTS_PAGE_SIZE });
}
