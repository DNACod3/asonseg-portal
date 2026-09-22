import { cache } from 'react';
import { prisma } from '@/shared/lib/prisma';

/**
 * Os 3 indicadores agregados da home pública (USP-041 / E-001). **Apenas
 * inteiros** — nenhum campo de PII. Esta é a barreira estrutural do
 * REL41-MN-01: o tipo não tem onde carregar nome/identificador de pessoa ou
 * empresa.
 */
export interface HomeIndicators {
  activeJobs: number;
  activeCandidates: number;
  verifiedCompanies: number;
}

/**
 * Lê os 3 contadores agregados da home pública direto do Postgres —
 * `count` puro, sem `select`/`findMany` de linha (TD §4.5, design.md §2):
 *  - `activeJobs`: `Job.status = ACTIVE` (MP4, estado materializado —
 *    ADR-0026, mesmo filtro on-read da busca pública/USP-024).
 *  - `activeCandidates`: `CandidateProfile.publicationStatus = ACTIVE` (MP1).
 *  - `verifiedCompanies`: `Company.isVerified = true` (MP2).
 *
 * `$transaction` dá consistência de snapshot entre os 3 counts (mesma
 * "foto" do banco). Nunca lança em baseline vazio — `count()` retorna `0`.
 *
 * Envolvida em `cache()` de `'react'` (mesmo padrão de dedupe do App Router
 * usado em `getCurrentPerson`/`canAccessModerationQueue`): a função não tem
 * parâmetros, então o `cache()` de-duplica por identidade da própria função
 * dentro da mesma árvore de render RSC. O painel `/inicio` (USP-067) chama
 * este helper tanto do loader CANDIDATE quanto do loader BOARD — um papel
 * composto CANDIDATE+BOARD pagaria os 3 counts em dobro sem o `cache()`.
 * Fora de uma render real (ex.: testes de integração chamando a função
 * diretamente), apenas executa sem memoizar — sem efeito colateral fora do
 * contexto de request (PR #297 review).
 */
export const getHomeIndicators = cache(async function getHomeIndicators(): Promise<HomeIndicators> {
  const [activeJobs, activeCandidates, verifiedCompanies] = await prisma.$transaction([
    prisma.job.count({ where: { status: 'ACTIVE' } }),
    prisma.candidateProfile.count({ where: { publicationStatus: 'ACTIVE' } }),
    prisma.company.count({ where: { isVerified: true } }),
  ]);

  return { activeJobs, activeCandidates, verifiedCompanies };
});
