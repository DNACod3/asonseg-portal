import { prisma } from '@/shared/lib/prisma';

export interface PausedJobNotice {
  paused: true;
}

/**
 * Distingue "vaga temporariamente pausada" (P-003) de "vaga encerrada" (USP-022,
 * inalterado) quando `getActiveJobDetail` devolve `null`. Consulta aditiva e leve —
 * NÃO substitui nem estende `getActiveJobDetail` (preserva o contrato testado
 * U22-MN-03). `select: { id: true }` apenas: sem dado sensível (sem PII, sem nome
 * real da Empresa) — a página só precisa saber "está pausada?".
 *
 * `company.isVerified` espelha o on-read de `getActiveJobDetail`/`searchJobs`:
 * uma vaga `PAUSED` de Empresa não verificada não deve exibir a mensagem de pausa
 * (mesma defesa em profundidade P-005 do detalhe público).
 */
export async function getPausedJobNotice(id: string): Promise<PausedJobNotice | null> {
  const row = await prisma.job.findFirst({
    where: { id, status: 'PAUSED', company: { isVerified: true } },
    select: { id: true },
  });
  return row ? { paused: true } : null;
}
