import Link from 'next/link';
import { Button } from '@/shared/ui';
import { formatDateOnly } from '@/shared/lib/time';
import type { InstitutionalPanelData } from '../_loaders/institutional';
import { KpiStrip } from './kpi-strip';
import { QuickActions } from './quick-actions';
import { DashboardCard } from './dashboard-card';
import { DashboardRow } from './dashboard-row';

export interface InstitutionalBlockProps {
  data: InstitutionalPanelData;
}

const REFERRAL_RESULT_LABELS: Record<string, string> = {
  HIRED: 'Contratado',
  NOT_SELECTED: 'Não selecionado',
  UNDER_REVIEW: 'Em avaliação',
  NO_RESPONSE: 'Sem resposta',
};

/**
 * Bloco institucional do painel `/inicio` (COORDINATOR/SOCIAL_ASSISTANT/
 * BOARD + voluntário delegado — USP-067 PNL-05/06/07). Read-only vs. ações é
 * decidido inteiramente por `data.canModerate`/`data.canRegisterReferralResult`
 * (D-001 / PNL-MN-03) — o componente nunca re-decide acesso, só obedece o
 * que o loader já resolveu.
 *
 * Ações da fila são só navegacionais (A-09) — um único "Revisar" (em vez de
 * "Revisar" + "Aprovar" redundantes, já que ambos levam ao mesmo `/moderacao`
 * sem decisão inline no painel) + "Validar empresa" quando `companyUnverified`.
 */
export function InstitutionalBlock({ data }: Readonly<InstitutionalBlockProps>) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="font-heading text-lg font-semibold text-fg">Institucional</h2>
      <QuickActions actions={data.quickActions} />
      <KpiStrip items={data.kpis} />
      <div className="grid gap-4 lg:grid-cols-2">
        <DashboardCard
          title="Fila de moderação"
          description={data.canModerate ? undefined : 'Somente leitura'}
          rows={data.queue.map((item) => (
            <DashboardRow
              key={`${item.contentKind}-${item.contentId}`}
              title={item.title}
              subtitle={item.authorName ?? undefined}
              meta={item.companyUnverified ? ['Empresa não verificada'] : undefined}
              actions={
                data.canModerate ? (
                  <>
                    <Button variant="outline" size="sm" asChild>
                      <Link href="/moderacao">Revisar</Link>
                    </Button>
                    {item.companyUnverified && (
                      <Button variant="outline" size="sm" asChild>
                        <Link href="/moderacao">Validar empresa</Link>
                      </Button>
                    )}
                  </>
                ) : undefined
              }
            />
          ))}
          footHref={data.canModerate ? '/moderacao' : undefined}
          footLabel="Ver fila completa"
          countHint={`${data.queue.length} de ${data.queueTotal}`}
        />
        <DashboardCard
          title="Encaminhamentos recentes"
          rows={data.referrals.map((referral) => (
            <DashboardRow
              key={referral.id}
              title={referral.referredPersonName}
              subtitle={`${referral.jobTitle} · ${referral.companyName}`}
              meta={[
                referral.result ? (REFERRAL_RESULT_LABELS[referral.result] ?? referral.result) : 'Sem resultado',
                `em ${formatDateOnly(referral.createdAt)}`,
              ]}
              actions={
                <>
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/encaminhamentos/${referral.id}`}>Ver detalhes</Link>
                  </Button>
                  {data.canRegisterReferralResult && (
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/encaminhamentos/${referral.id}/resultado`}>Registrar resultado</Link>
                    </Button>
                  )}
                </>
              }
            />
          ))}
          countHint={`${data.referrals.length} de ${data.referralsTotal}`}
        />
      </div>
    </section>
  );
}
