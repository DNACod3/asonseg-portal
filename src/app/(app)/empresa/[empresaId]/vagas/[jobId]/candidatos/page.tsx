import { notFound } from 'next/navigation';
import { requireActivePerson } from '@/modules/identity';
import { listJobApplicants, JobApplicantsList } from '@/modules/jobs';
import { FormHeader } from '@/shared/ui';

// Rota (app): área autenticada — sem cache, revalida a sessão a cada request (ADR-0030).
export const dynamic = 'force-dynamic';

/**
 * Candidatos de uma vaga (USP-027 / CAN-03). Só o responsável ATIVO da Empresa
 * dona da vaga acessa; `NOT_FOUND` (vaga inexistente) e `FORBIDDEN` (outra
 * Empresa/não-responsável) resultam no mesmo `notFound()` — não revela a
 * existência da vaga/Empresa a quem não tem acesso (mesmo padrão de
 * `vagas/[jobId]/editar` e `empresa/[empresaId]/vagas`).
 *
 * `listJobApplicants` já é a fonte única de auditoria (`APPLICATION_VIEWED_BY_EMPLOYER`
 * + `SENSITIVE_FIELD_VIEWED`) — a página só consome o resultado, nunca o Prisma.
 */
export default async function VagaCandidatosPage({
  params,
}: {
  params: Promise<{ empresaId: string; jobId: string }>;
}) {
  const { jobId } = await params;
  const viewer = await requireActivePerson();

  const res = await listJobApplicants({ jobId }, viewer);
  if (!res.ok) {
    notFound();
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6">
      <FormHeader
        title="Candidatos da vaga"
        description={`${res.data.total} ${res.data.total === 1 ? 'candidatura ativa' : 'candidaturas ativas'}.`}
      />
      <JobApplicantsList applicants={res.data.applicants} />
    </main>
  );
}
