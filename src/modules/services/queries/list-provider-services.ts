import { prisma } from '@/shared/lib/prisma';
import type { ContentStatus } from '@/modules/moderation';

/** `select` mínimo para a lista de gestão do prestador — dado próprio, sem anonimização. */
export interface ProviderServiceRow {
  id: string;
  title: string;
  status: ContentStatus;
  publishedAt: Date | null;
  lastStatusChangeAt: Date;
}

/** Tamanho máximo da lista de gestão (`take` obrigatório, CLAUDE.md). */
export const PROVIDER_SERVICES_PAGE_SIZE = 100;

/**
 * Lista os serviços de um prestador (**todos** os status, PF e em nome de
 * Empresas que representa) para o painel de gestão da própria Pessoa (USP-032).
 * Dado do próprio prestador → sem anonimização (CLAUDE.md: "Direct Prisma
 * access is only OK when a Person views their own data"). Espelha
 * `listCompanyJobs`, mas escopado por `authorPersonId` (não `companyId` —
 * serviço PF não tem Empresa). Ordena por status (agrupa DRAFT/ACTIVE/PAUSED/
 * etc.) e depois pelo mais recente.
 */
export async function listProviderServices(personId: string): Promise<ProviderServiceRow[]> {
  const rows = await prisma.service.findMany({
    where: { authorPersonId: personId },
    orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    take: PROVIDER_SERVICES_PAGE_SIZE,
    select: {
      id: true,
      title: true,
      status: true,
      publishedAt: true,
      lastStatusChangeAt: true,
    },
  });
  // Só o enum precisa de ponte Prisma→domínio (mesmas strings, tipos nominais
  // distintos — content-status.ts).
  return rows.map((row) => ({ ...row, status: row.status as unknown as ContentStatus }));
}
