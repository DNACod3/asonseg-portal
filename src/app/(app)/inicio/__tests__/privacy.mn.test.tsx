import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { ContentKind } from '@/modules/moderation';
import type { ProviderPanelData } from '../_loaders/provider';
import type { InstitutionalPanelData } from '../_loaders/institutional';
import type { CompanyPanelData } from '../_loaders/company';

/**
 * USP-067 — T18 / PNL-MN-01, PNL-MN-02, PNL-MN-03.
 *
 * Testes negativos de payload: renderizam os blocos por papel com dados
 * "envenenados" (decoy) — um campo restrito de terceiro com um valor único e
 * reconhecível, que a interface do loader **não declara**, mas que um
 * mutante futuro (spread descuidado de `data`, novo campo de debug, etc.)
 * poderia vazar. Cada asserção busca a STRING do valor decoy no
 * `container.innerHTML` — se aparecer, o teste falha (decoy killable). Não
 * exercitam loaders (já cobertos por T12-T16); só o contrato apresentacional
 * dos blocos.
 *
 * Nenhum client button (ResubmitServiceButton/ResubmitJobButton) é
 * renderizado em `canEdit`/`canSubmit: false` — não precisa mock de
 * `next/navigation` para os blocos usados aqui (Provider/Institutional/
 * Company só via `canEdit`/`canSubmit: false` nos casos abaixo).
 */

const DECOY_CPF = '111.222.333-44';
const DECOY_BIRTH_DATE = '1990-01-01';
const DECOY_ADDRESS = 'Rua Falsa Envenenada, 123 - Bairro Decoy';
const DECOY_CANDIDATE_NAME = 'Candidato Vazado Decoy';
const DECOY_CANDIDATE_EMAIL = 'candidato-vazado-decoy@example.com';
const DECOY_CANDIDATE_PHONE = '(11) 90000-0000';

describe('painel /inicio — must-nots de privacidade no payload (USP-067 T18)', () => {
  describe('PNL-MN-01 — nenhum campo restrito de terceiro no payload renderizado', () => {
    it('ProviderBlock: cpf/birthDate/fullAddress do cliente interessado não aparecem no markup', async () => {
      const { ProviderBlock } = await import('../_components/provider-block');

      const data: ProviderPanelData = {
        kpis: [],
        quickActions: [],
        interests: [
          {
            interestId: 'int-1',
            clientName: 'Cliente Legítimo',
            phone: '(11) 91234-5678',
            email: 'cliente@example.com',
            serviceTitle: 'Serviço X',
            // Campos que a interface `ProviderInterestRow` NÃO declara —
            // simulam um vazamento se o componente algum dia espalhar
            // `{...interest}` ou ler chaves adicionais do objeto.
            cpf: DECOY_CPF,
            birthDate: DECOY_BIRTH_DATE,
            fullAddress: DECOY_ADDRESS,
          } as unknown as ProviderPanelData['interests'][number],
        ],
        interestsTotal: 1,
        services: [],
        servicesTotal: 0,
      };

      const { container } = render(<ProviderBlock data={data} />);

      // Fronteira já existente (viewClientForProvider): nome/telefone/e-mail
      // do cliente SÃO exibidos — não é o que este teste proíbe.
      expect(container.innerHTML).toContain('Cliente Legítimo');

      // Campos restritos (cpf/birthDate/fullAddress) NUNCA.
      expect(container.innerHTML).not.toContain(DECOY_CPF);
      expect(container.innerHTML).not.toContain(DECOY_BIRTH_DATE);
      expect(container.innerHTML).not.toContain(DECOY_ADDRESS);
    });

    it('InstitutionalBlock: cpf/birthDate/fullAddress da pessoa encaminhada não aparecem no markup', async () => {
      const { InstitutionalBlock } = await import('../_components/institutional-block');

      const data: InstitutionalPanelData = {
        canModerate: true,
        canRegisterReferralResult: false,
        kpis: [],
        quickActions: [],
        queue: [],
        queueTotal: 0,
        referrals: [
          {
            id: 'ref-1',
            jobTitle: 'Vaga Y',
            companyName: 'Empresa Y',
            referredPersonName: 'Pessoa Encaminhada',
            result: null,
            createdAt: new Date('2026-01-05T00:00:00Z'),
            // Campos fora de `InstitutionalReferralRow` — mesmo racional do
            // decoy acima.
            cpf: DECOY_CPF,
            birthDate: DECOY_BIRTH_DATE,
            fullAddress: DECOY_ADDRESS,
          } as unknown as InstitutionalPanelData['referrals'][number],
        ],
        referralsTotal: 1,
      };

      const { container } = render(<InstitutionalBlock data={data} />);

      // Nome da pessoa encaminhada já é exposto pela superfície de
      // encaminhamentos (staff view) — não é o que este teste proíbe.
      expect(container.innerHTML).toContain('Pessoa Encaminhada');

      expect(container.innerHTML).not.toContain(DECOY_CPF);
      expect(container.innerHTML).not.toContain(DECOY_BIRTH_DATE);
      expect(container.innerHTML).not.toContain(DECOY_ADDRESS);
    });
  });

  describe('PNL-MN-02 — card COMPANY sem identidade de candidato', () => {
    it('CompanyBlock: "Candidaturas recentes" não expõe nome/e-mail/telefone/cpf de candidato', async () => {
      const { CompanyBlock } = await import('../_components/company-block');

      const data: CompanyPanelData = {
        hasActiveCompany: true,
        kpis: [],
        quickActions: [],
        jobs: [],
        jobsTotal: 0,
        recentApplications: [
          {
            jobId: 'job-1',
            companyId: 'company-1',
            jobTitle: 'Vaga Z',
            appliedAt: new Date('2026-01-10T00:00:00Z'),
            // Identidade de candidato — fora de `CompanyRecentApplicationPanelRow`
            // por design (A-08/PNL-MN-02); simulada aqui como decoy.
            candidateName: DECOY_CANDIDATE_NAME,
            candidateEmail: DECOY_CANDIDATE_EMAIL,
            candidatePhone: DECOY_CANDIDATE_PHONE,
            candidateCpf: DECOY_CPF,
          } as unknown as CompanyPanelData['recentApplications'][number],
        ],
        recentApplicationsTotal: 1,
      };

      const { container } = render(<CompanyBlock data={data} />);

      // A linha só mostra vaga + data — a identidade só existe na
      // superfície auditada por vaga (`/empresa/[id]/vagas/[jobId]/candidatos`).
      expect(container.innerHTML).toContain('Vaga Z');
      expect(container.innerHTML).not.toContain(DECOY_CANDIDATE_NAME);
      expect(container.innerHTML).not.toContain(DECOY_CANDIDATE_EMAIL);
      expect(container.innerHTML).not.toContain(DECOY_CANDIDATE_PHONE);
      expect(container.innerHTML).not.toContain(DECOY_CPF);
    });
  });

  describe('PNL-MN-03 — read-only sem ação/rota de moderação', () => {
    it('InstitutionalBlock: canModerate=false não renderiza "Revisar"/"Validar empresa" nem link para /moderacao', async () => {
      const { InstitutionalBlock } = await import('../_components/institutional-block');

      const data: InstitutionalPanelData = {
        canModerate: false,
        canRegisterReferralResult: false,
        kpis: [],
        quickActions: [],
        queue: [
          {
            contentKind: ContentKind.JOB,
            contentId: 'content-1',
            title: 'Vaga pendente',
            authorName: 'Autor',
            companyUnverified: true,
            companyId: 'company-1',
          },
        ],
        queueTotal: 1,
        referrals: [],
        referralsTotal: 0,
      };

      const { queryByText, container } = render(<InstitutionalBlock data={data} />);

      expect(queryByText('Revisar')).not.toBeInTheDocument();
      expect(queryByText('Validar empresa')).not.toBeInTheDocument();
      expect(queryByText('Ver fila completa')).not.toBeInTheDocument();
      expect(container.innerHTML).not.toContain('href="/moderacao"');
      // Sinaliza estado somente leitura ao usuário.
      expect(queryByText('Somente leitura')).toBeInTheDocument();
    });
  });
});
