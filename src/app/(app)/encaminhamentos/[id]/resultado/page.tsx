import { notFound } from 'next/navigation';
import { requireActivePerson } from '@/modules/identity';
import { canRegisterReferralResult, ResultForm } from '@/modules/referrals';
import { viewPersonForStaff } from '@/modules/persons';
import { prisma } from '@/shared/lib/prisma';
import { FormCard, FormHeader } from '@/shared/ui';

// Rota (app): área autenticada — sem cache, revalida a sessão a cada request (ADR-0030).
export const dynamic = 'force-dynamic';

/**
 * Registrar resultado do encaminhamento (USP-038 / SOC-05). Visível a
 * coordenadores, assistentes sociais e voluntários com delegação ativa de
 * `REGISTER_REFERRAL_RESULT` (ADR-0001 / USP-008); quem não tem acesso recebe
 * 404 — a rota não revela sua existência (REF38-MN-02 na rota). A Server
 * Action `registerReferralResult` ainda re-checa a permissão (defesa em profundidade).
 */
export default async function RegistrarResultadoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const person = await requireActivePerson();
  if (!(await canRegisterReferralResult(person))) {
    notFound();
  }

  const { id } = await params;
  const referral = await prisma.referral.findUnique({
    where: { id },
    select: {
      result: true,
      resultObservation: true,
      personId: true,
      job: { select: { title: true } },
    },
  });
  if (!referral) {
    notFound();
  }

  const personView = await viewPersonForStaff(referral.personId);
  if (!personView) {
    notFound();
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 px-6 py-10">
      <FormHeader
        title="Registrar resultado do encaminhamento"
        description={`${personView.fullName} — ${referral.job.title}`}
      />

      <FormCard>
        <ResultForm
          referralId={id}
          initialResult={referral.result}
          initialObservation={referral.resultObservation}
        />
      </FormCard>
    </main>
  );
}
