import Link from 'next/link';
import { formatSaoPaulo } from '@/shared/lib/time';
import { Badge, Card } from '@/shared/ui';
import { ALL_ROLE_LABELS } from '@/modules/identity';
import { labelContentStatus } from '@/modules/reporting';
import { COMPANY_GRANT_STATUS_LABELS } from '@/modules/companies';
import { INCOME_BRACKET_LABELS, HOUSING_SITUATION_LABELS } from '../domain/socioeconomic-record';
import { PERSON_STATUS_LABELS } from '../domain/person-status-labels';
import type { ConsolidatedPersonView } from '../views/view-person-for-social-assistant';

export interface ConsolidatedPersonPanelProps {
  view: ConsolidatedPersonView;
}

const REFERRAL_RESULT_LABELS: Record<string, string> = {
  HIRED: 'Contratado',
  NOT_SELECTED: 'Não selecionado',
  UNDER_REVIEW: 'Em avaliação',
  NO_RESPONSE: 'Sem resposta',
};

/**
 * Painel único da visão consolidada de uma Pessoa (USP-039 / SOC-06). Consome
 * **só** `ConsolidatedPersonView` — nunca acessa Prisma/queries diretamente
 * (o assembler é a fonte única de anonimização, AC-039-4). Componente
 * read-only: pode linkar para `ficha-social` (editar) e `encaminhamentos/novo`,
 * nunca executa escrita.
 *
 * **Privacidade (B2 do SOC-039-MN-01):** a seção da ficha socioeconômica só é
 * montada quando `view.ficha != null` (coordenador recebe `ficha=null` do
 * assembler — nenhum rótulo/valor sensível é renderizado, porque o dado nem
 * chega a este componente).
 */
export function ConsolidatedPersonPanel({ view }: Readonly<ConsolidatedPersonPanelProps>) {
  const { person, ficha } = view;

  return (
    <div className="flex flex-col gap-6">
      <Card className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-semibold text-fg">{person.fullName}</h1>
          <Badge variant={person.status === 'ATIVO' ? 'green' : 'gray'}>
            {PERSON_STATUS_LABELS[person.status] ?? person.status}
          </Badge>
        </div>
        {person.roles.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {person.roles.map((role) => (
              <Badge key={role} variant="blue">
                {ALL_ROLE_LABELS[role] ?? role}
              </Badge>
            ))}
          </div>
        ) : (
          <p className="text-sm text-fg-muted">Sem papéis ativos.</p>
        )}
        {person.status === 'INATIVO' && (
          <p className="text-sm text-fg-muted">
            Inativada{person.inactivatedAt ? ` em ${formatSaoPaulo(new Date(person.inactivatedAt))}` : ''}
            {person.inactivationReason ? ` — ${person.inactivationReason}` : ''}
          </p>
        )}
        <div>
          <Link
            href={`/pessoas/${person.id}/ficha-social`}
            className="text-sm font-medium text-primary underline-offset-2 hover:underline"
          >
            Ver/editar ficha socioeconômica
          </Link>
        </div>
      </Card>

      {ficha != null && (
        <Card className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold text-fg">Ficha socioeconômica</h2>
          <dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-fg-muted">Renda aproximada</dt>
              <dd className="text-fg">
                {ficha.incomeBracket ? INCOME_BRACKET_LABELS[ficha.incomeBracket] : 'Não informada'}
              </dd>
            </div>
            <div>
              <dt className="text-fg-muted">Benefício social</dt>
              <dd className="text-fg">{ficha.socialBenefit ?? 'Não informado'}</dd>
            </div>
            <div>
              <dt className="text-fg-muted">Situação de moradia</dt>
              <dd className="text-fg">
                {ficha.housingSituation ? HOUSING_SITUATION_LABELS[ficha.housingSituation] : 'Não informada'}
              </dd>
            </div>
            <div>
              <dt className="text-fg-muted">Composição familiar</dt>
              <dd className="text-fg">{ficha.familyComposition ?? 'Não informada'}</dd>
            </div>
          </dl>
        </Card>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-fg">Candidaturas</h2>
        {view.applications.length === 0 ? (
          <Card>
            <p className="text-sm text-fg-muted">Nenhuma candidatura.</p>
          </Card>
        ) : (
          <div className="flex flex-col gap-3">
            {view.applications.map((application) => (
              <Card key={application.id} className="flex flex-col gap-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium text-fg">{application.jobTitle}</p>
                  <Badge variant={application.active ? 'green' : 'gray'}>
                    {application.active ? 'Ativa' : 'Histórica'}
                  </Badge>
                  {application.viaEncaminhamento && <Badge variant="blue">Via encaminhamento</Badge>}
                </div>
                <p className="text-sm text-fg-muted">{application.companyName}</p>
                <time dateTime={application.appliedAt.toISOString()} className="text-sm text-fg-muted">
                  Candidatou-se em {formatSaoPaulo(application.appliedAt)}
                </time>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold text-fg">Encaminhamentos</h2>
          <Link
            href={`/encaminhamentos/novo?personId=${person.id}`}
            className="text-sm font-medium text-primary underline-offset-2 hover:underline"
          >
            Novo encaminhamento
          </Link>
        </div>
        {view.referrals.length === 0 ? (
          <Card>
            <p className="text-sm text-fg-muted">Nenhum encaminhamento.</p>
          </Card>
        ) : (
          <div className="flex flex-col gap-3">
            {view.referrals.map((referral) => (
              <Card key={referral.id} className="flex flex-col gap-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium text-fg">{referral.jobTitle}</p>
                  <Badge variant={referral.result ? 'blue' : 'gray'}>
                    {referral.result ? REFERRAL_RESULT_LABELS[referral.result] : 'Sem resultado'}
                  </Badge>
                </div>
                <p className="text-sm text-fg-muted">{referral.companyName}</p>
                <p className="text-sm text-fg-muted">Encaminhado por {referral.referrerName}</p>
                {referral.justification && (
                  <p className="text-sm text-fg-muted">Justificativa: {referral.justification}</p>
                )}
                {referral.resultObservation && (
                  <p className="text-sm text-fg-muted">Observação: {referral.resultObservation}</p>
                )}
                <time dateTime={referral.createdAt.toISOString()} className="text-sm text-fg-muted">
                  Encaminhado em {formatSaoPaulo(referral.createdAt)}
                </time>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-fg">Serviços oferecidos</h2>
        {view.servicesOffered.length === 0 ? (
          <Card>
            <p className="text-sm text-fg-muted">Nenhum serviço oferecido.</p>
          </Card>
        ) : (
          <div className="flex flex-col gap-3">
            {view.servicesOffered.map((service) => (
              <Card key={service.id} className="flex flex-wrap items-center gap-2">
                <p className="font-medium text-fg">{service.title}</p>
                <Badge variant="gray">{labelContentStatus(service.status)}</Badge>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-fg">Manifestações de interesse</h2>
        {view.serviceInterests.length === 0 ? (
          <Card>
            <p className="text-sm text-fg-muted">Nenhuma manifestação de interesse.</p>
          </Card>
        ) : (
          <div className="flex flex-col gap-3">
            {view.serviceInterests.map((interest) => (
              <Card key={interest.id} className="flex flex-col gap-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium text-fg">{interest.serviceTitle}</p>
                  <Badge variant={interest.active ? 'green' : 'gray'}>
                    {interest.active ? 'Ativa' : 'Cancelada'}
                  </Badge>
                </div>
                <p className="text-sm text-fg-muted">Prestador: {interest.providerName}</p>
                <time dateTime={interest.interestedAt.toISOString()} className="text-sm text-fg-muted">
                  Manifestada em {formatSaoPaulo(interest.interestedAt)}
                </time>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-fg">Papéis organizacionais</h2>
        {view.companyGrants.length === 0 ? (
          <Card>
            <p className="text-sm text-fg-muted">Nenhum vínculo com Empresa.</p>
          </Card>
        ) : (
          <div className="flex flex-col gap-3">
            {view.companyGrants.map((grant) => (
              <Card key={grant.grantId} className="flex flex-wrap items-center gap-2">
                <p className="font-medium text-fg">{grant.companyName}</p>
                <Badge variant={grant.status === 'ACTIVE' ? 'green' : 'orange'}>
                  {COMPANY_GRANT_STATUS_LABELS[grant.status] ?? grant.status}
                </Badge>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
