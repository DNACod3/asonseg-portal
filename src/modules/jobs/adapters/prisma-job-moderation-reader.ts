import { Prisma } from '@prisma/client';
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
 * Lê o conteúdo **integral** do rascunho — sem filtro de `status` no `select`
 * (o item já chega `IN_MODERATION` pela fila; a fronteira de permissão é a
 * Server Action `openModerationContent`, não este adapter). Reproduz a
 * seleção de `viewJobDetail`, mas **sem** anonimização de papel (E-001 —
 * "como será publicado"): `companyName` é sempre o nome público, nunca o
 * rótulo por setor.
 */
export class PrismaJobModerationReader implements ContentModerationReader {
  async readContent(_kind: ContentKind, jobId: string): Promise<ModerationContentView | null> {
    const row = await prisma.job.findUnique({
      where: { id: jobId },
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
