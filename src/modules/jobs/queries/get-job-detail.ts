import { cache } from 'react';
import { Prisma } from '@prisma/client';
import type { CurrentPerson } from '@/modules/identity';
import { prisma } from '@/shared/lib/prisma';
import { hojeSaoPaulo } from '@/shared/lib/time';
import type { JobDetailRow } from '../views/job-detail.view';

/**
 * `select` explícito por papel (P-002 — least privilege), espelhando `search-jobs.ts`.
 * O nome real da Empresa (`nomeFantasia`) é dado restrito para o anônimo (ADR-0017):
 * NÃO é sequer carregado quando não há viewer — assim não vaza no HTML/Flight/JSON nem
 * por engano de template. O `setor` (base da anonimização) é sempre buscado.
 *
 * O contador de candidaturas ATIVAS (`cancelledAt = null`, E-003) é um `_count` filtrado
 * na própria query — sem N+1 e sem round-trip extra ao banco.
 */
function jobDetailSelect(authenticated: boolean) {
  return {
    id: true,
    title: true,
    description: true,
    requirements: true,
    benefits: true,
    workRegime: true,
    location: true,
    contractType: true,
    educationLevelRequired: true,
    salaryMin: true,
    salaryMax: true,
    salaryVisible: true,
    validUntil: true,
    publishedAt: true,
    area: { select: { name: true } },
    region: { select: { name: true } },
    company: { select: { setor: true, ...(authenticated ? { nomeFantasia: true } : {}) } },
    _count: { select: { applications: { where: { cancelledAt: null } } } },
  } satisfies Prisma.JobSelect;
}

/**
 * Detalhe de uma vaga **detalhável** (USP-022 / TD §4.4). Read-only, sem Server Action
 * (leitura pública). Espelha exatamente o `where` on-read de `searchJobs`: uma vaga só é
 * detalhável se passaria na busca pública.
 *
 * - On-read obrigatório (E-005/P-004/P-005): `status='ACTIVE'` **AND** `valid_until >= hoje(SP)`
 *   **AND** `company.is_verified`. A expiração é resolvida aqui, não pelo job da USP-024;
 *   Empresa rebaixada (USP-015) cai pelo `is_verified`.
 * - **Retorna `null`** quando a vaga não casa o on-read → a página renderiza o estado
 *   "vaga encerrada" (E-005), nunca um 404 técnico nem candidatura silenciosa.
 * - O nome real da Empresa só é carregado para o `viewer` autenticado (P-002).
 * - Conta candidaturas ATIVAS (`cancelledAt = null`) numa única query (sem N+1, sem
 *   round-trip extra) para o contador do detalhe (E-003); o limiar é aplicado no View
 *   Model (`viewJobDetail`).
 * - Memoizada por (id, autenticado) com React `cache()`: num mesmo request, o
 *   `generateMetadata` (anônimo) e o componente da página compartilham a leitura quando o
 *   viewer é anônimo (caso comum da rota pública) → 1 ida ao banco, não 2. Para o
 *   autenticado as chaves divergem (o `select` do nome real é condicional, P-002), o que é
 *   necessário e aceitável.
 */
const getActiveJobDetailCached = cache(
  async (id: string, authenticated: boolean): Promise<JobDetailRow | null> => {
    const row = await prisma.job.findFirst({
      where: {
        id,
        status: 'ACTIVE',
        validUntil: { gte: hojeSaoPaulo() },
        company: { isVerified: true },
      },
      select: jobDetailSelect(authenticated),
    });

    if (!row) return null;

    const { _count, ...job } = row;
    return { ...job, applicationCount: _count.applications };
  },
);

export function getActiveJobDetail(
  id: string,
  viewer: CurrentPerson | null,
): Promise<JobDetailRow | null> {
  return getActiveJobDetailCached(id, viewer !== null);
}
