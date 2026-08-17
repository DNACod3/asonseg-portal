import { ContentStatus as PrismaContentStatus, Prisma } from '@prisma/client';
import type { ContentKind, ContentModerationReader, ModerationContentView } from '@/modules/moderation';
import { prisma } from '@/shared/lib/prisma';
import { decimalToNumber } from '../views/company-display';

const brl = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  maximumFractionDigits: 0,
});

/** Faixa salarial formatada — espelha `salaryLabel` de `components/job-detail.tsx`. */
function salaryRangeLabel(min: number | null, max: number | null): string | null {
  if (min != null && max != null) {
    return min === max ? brl.format(min) : `${brl.format(min)} – ${brl.format(max)}`;
  }
  if (min != null) return `A partir de ${brl.format(min)}`;
  if (max != null) return `Até ${brl.format(max)}`;
  return null;
}

const jobModerationSelect = {
  title: true,
  description: true,
  requirements: true,
  salary: true,
  salaryMin: true,
  salaryMax: true,
  salaryVisible: true,
  workRegime: true,
  contractType: true,
  educationLevelRequired: true,
  location: true,
  area: { select: { name: true } },
  region: { select: { name: true } },
  company: { select: { razaoSocial: true, nomeFantasia: true } },
} satisfies Prisma.JobSelect;

/**
 * Adapter Prisma do {@link ContentModerationReader} para a vaga (USP-066 / E-002).
 *
 * Lê o conteúdo **integral** do rascunho, **escopado a `status: IN_MODERATION`**
 * (correção A1 do review da PR #294): `contentId` chega do cliente e só é
 * validado como UUID (`openContentSchema`) — sem este filtro, qualquer
 * portador de `MODERATE_JOB` conseguiria ler o conteúdo de qualquer vaga por
 * `id`, inclusive fora do estado que a fila (`viewModerationQueue`, mesmo
 * filtro) lista. `@@index([status])` já existe. Fora do estado ⇒ `null` ⇒
 * `NOT_FOUND` (E-006). Reproduz a seleção de `viewJobDetail`, mas **sem**
 * anonimização de papel (E-001 — "como será publicado"): `companyName` é
 * sempre o nome público, nunca o rótulo por setor.
 */
export class PrismaJobModerationReader implements ContentModerationReader {
  async readContent(_kind: ContentKind, jobId: string): Promise<ModerationContentView | null> {
    const row = await prisma.job.findFirst({
      where: { id: jobId, status: PrismaContentStatus.IN_MODERATION },
      select: jobModerationSelect,
    });
    if (!row) return null;

    const salaryRange = row.salaryVisible
      ? (salaryRangeLabel(decimalToNumber(row.salaryMin), decimalToNumber(row.salaryMax)) ?? row.salary)
      : null;

    return {
      kind: 'JOB',
      title: row.title,
      description: row.description,
      requirements: row.requirements,
      salaryRange,
      workRegime: row.workRegime,
      contractType: row.contractType,
      educationLevelRequired: row.educationLevelRequired,
      location: row.location,
      area: row.area?.name ?? null,
      region: row.region?.name ?? null,
      companyName: row.company.nomeFantasia ?? row.company.razaoSocial,
    };
  }
}
