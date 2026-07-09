import { notFound } from 'next/navigation';
import { requireActivePerson } from '@/modules/identity';
import { canReferPersonToJob, ReferralForm } from '@/modules/referrals';
import { FormCard, FormHeader } from '@/shared/ui';

// Rota (app): área autenticada — sem cache, revalida a sessão a cada request (ADR-0030).
export const dynamic = 'force-dynamic';

/**
 * Encaminhar Pessoa para vaga (USP-037 / SOC-03, SOC-04). Visível a
 * coordenadores, assistentes sociais e voluntários com delegação ativa de
 * `REFER_PERSON_TO_JOB` (ADR-0001 / USP-008); quem não tem acesso recebe 404 —
 * a rota não revela sua existência (REF-MN-04 na rota). A Server Action
 * `createReferral` ainda re-checa a permissão (defesa em profundidade).
 *
 * `personId`/`jobId` na querystring pré-preenchem o form (ex.: link a partir
 * da ficha da Pessoa ou do detalhe da vaga) — sem busca embutida (fatia
 * vertical fina; a busca de Pessoa/vaga é fora do escopo desta USP).
 */
export default async function NovoEncaminhamentoPage({
  searchParams,
}: {
  searchParams: Promise<{ personId?: string; jobId?: string }>;
}) {
  const person = await requireActivePerson();
  if (!(await canReferPersonToJob(person))) {
    notFound();
  }

  const { personId, jobId } = await searchParams;

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 px-6 py-10">
      <FormHeader
        title="Encaminhar Pessoa para vaga"
        description="Encaminhamento institucional da ASONSEG: ativa o papel candidato (aceite tácito), gera a candidatura vinculada com a indicação de encaminhamento e avisa a Pessoa por e-mail, quando disponível."
      />

      <FormCard>
        <ReferralForm initialPersonId={personId} initialJobId={jobId} />
      </FormCard>
    </main>
  );
}
