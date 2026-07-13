/**
 * Catálogo puro de atalhos do hub `/inicio` (USP-049 — ORQ-1).
 *
 * `buildHubLinks` é o núcleo testável e **sem IO** que garante que o hub nunca
 * link a uma rota inexistente ou fora da allowlist (HUB-MN-01) nem a uma área
 * sem permissão (HUB-MN-02). A visibilidade de cada link espelha o guard real
 * da rota-alvo — mas como **predicados locais**, sem importar outros módulos
 * em runtime (Dependencies: nenhuma — ver design.md "Tech Decisions"). Isso
 * evita acoplamento cruzado (`identity` não depende de `reporting`/`moderation`
 * em runtime aqui); a página (`(app)/inicio/page.tsx`, composition-root)
 * resolve o flag `moderation` com o guard ao vivo `canAccessModerationQueue`.
 */

/** Flags de acesso que decidem quais grupos/links o hub exibe. */
export interface HubAccess {
  candidate: boolean;
  provider: boolean;
  companyResponsible: boolean;
  moderation: boolean;
  referral: boolean;
  assistedRegistration: boolean;
  credentialClaim: boolean;
  reports: boolean;
  permissions: boolean;
}

export interface HubLink {
  href: string;
  label: string;
  description: string;
}

export interface HubLinkGroup {
  title: string;
  links: HubLink[];
}

/**
 * Allowlist de rotas reais que o hub pode linkar — a especificação única do
 * sensor HUB-MN-01. Se uma rota `(app)` mudar/for removida, este array (e o
 * teste que o exercita) é o primeiro lugar a atualizar. Fonte: `src/app/(app)`.
 */
export const EXISTING_HUB_ROUTES = [
  '/perfil',
  '/perfil/papeis',
  '/consentimentos',
  '/candidato',
  '/prestador',
  '/prestador/servicos',
  '/prestador/manifestacoes',
  '/empresa/cadastrar',
  '/moderacao',
  '/relatorios',
  '/encaminhamentos/novo',
  '/cadastro-assistido',
  '/credenciais/reivindicacoes',
  '/permissoes',
] as const satisfies readonly string[];

// Role-sets institucionais, espelhados localmente (sem importar outro módulo
// em runtime) a partir dos guards reais das rotas-alvo:
// - reports:              canViewOperationalReports ∪ canViewSocialReports (reporting/domain/report-access.ts)
// - referral:              COORDINATOR/SOCIAL_ASSISTANT (espelha REFER_PERSON_TO_JOB de ROLE_PERMISSIONS)
// - assistedRegistration:  canRegisterAssisted (identity/domain/assisted-registration.ts)
// - credentialClaim:       canApproveCredentialClaim (identity/domain/credential-claim.ts)
// - permissions:           isCoordinator (identity/domain/permissions.ts)
const REPORTS_ROLES: readonly string[] = ['COORDINATOR', 'BOARD', 'SOCIAL_ASSISTANT'];
const REFERRAL_ROLES: readonly string[] = ['COORDINATOR', 'SOCIAL_ASSISTANT'];
const ASSISTED_REGISTRATION_ROLES_MIRROR: readonly string[] = ['SOCIAL_ASSISTANT', 'BOARD'];
const CREDENTIAL_CLAIM_ROLES_MIRROR: readonly string[] = ['SOCIAL_ASSISTANT', 'BOARD', 'COORDINATOR'];
const PERMISSIONS_ROLES: readonly string[] = ['COORDINATOR'];

/**
 * Deriva os flags de acesso **por papel inerente** (`person.roles`) — exclui
 * `moderation`, que a página resolve com o guard ao vivo
 * `canAccessModerationQueue` (o acesso do voluntário é só por delegação).
 */
export function hubAccessFromRoles(roles: readonly string[]): Omit<HubAccess, 'moderation'> {
  return {
    candidate: roles.includes('CANDIDATE'),
    provider: roles.includes('PROVIDER'),
    companyResponsible: roles.includes('COMPANY_RESPONSIBLE'),
    referral: roles.some((role) => REFERRAL_ROLES.includes(role)),
    assistedRegistration: roles.some((role) => ASSISTED_REGISTRATION_ROLES_MIRROR.includes(role)),
    credentialClaim: roles.some((role) => CREDENTIAL_CLAIM_ROLES_MIRROR.includes(role)),
    reports: roles.some((role) => REPORTS_ROLES.includes(role)),
    permissions: roles.some((role) => PERMISSIONS_ROLES.includes(role)),
  };
}

/**
 * Monta os grupos/links do hub a partir dos flags de acesso — pura, sem IO.
 * Sempre inclui o grupo "Minha conta" (HUB-02 — garante hub não-vazio mesmo
 * para uma Pessoa sem nenhum papel público/institucional ativo).
 */
export function buildHubLinks(access: HubAccess): HubLinkGroup[] {
  const groups: HubLinkGroup[] = [
    {
      title: 'Minha conta',
      links: [
        { href: '/perfil', label: 'Meu perfil', description: 'Seus dados, e-mail e CPF.' },
        {
          href: '/perfil/papeis',
          label: 'Ativar um papel',
          description: 'Torne-se candidato(a), prestador(a) ou responsável de empresa.',
        },
        {
          href: '/consentimentos',
          label: 'Meus consentimentos',
          description: 'Gerencie as autorizações de uso dos seus dados.',
        },
      ],
    },
  ];

  const roleLinks: HubLink[] = [];
  if (access.candidate) {
    roleLinks.push({
      href: '/candidato',
      label: 'Área do candidato',
      description: 'Currículo e vagas.',
    });
  }
  if (access.provider) {
    roleLinks.push(
      { href: '/prestador', label: 'Área do prestador', description: 'Seu perfil de serviços.' },
      { href: '/prestador/servicos', label: 'Meus serviços', description: 'Cadastre e gerencie seus serviços.' },
      {
        href: '/prestador/manifestacoes',
        label: 'Minhas manifestações de interesse',
        description: 'Acompanhe o interesse em seus serviços.',
      },
    );
  }
  if (access.companyResponsible) {
    roleLinks.push({
      href: '/empresa/cadastrar',
      label: 'Empresas — cadastrar nova',
      description: 'Registre uma nova empresa responsável.',
    });
  }
  if (roleLinks.length > 0) {
    groups.push({ title: 'Meus papéis', links: roleLinks });
  }

  const institutionalLinks: HubLink[] = [];
  if (access.moderation) {
    institutionalLinks.push({
      href: '/moderacao',
      label: 'Fila de moderação',
      description: 'Revise conteúdo pendente.',
    });
  }
  if (access.reports) {
    institutionalLinks.push({
      href: '/relatorios',
      label: 'Relatórios',
      description: 'Indicadores operacionais e sociais.',
    });
  }
  if (access.referral) {
    institutionalLinks.push({
      href: '/encaminhamentos/novo',
      label: 'Novo encaminhamento',
      description: 'Encaminhe uma Pessoa a um serviço.',
    });
  }
  if (access.assistedRegistration) {
    institutionalLinks.push({
      href: '/cadastro-assistido',
      label: 'Cadastro assistido',
      description: 'Cadastre uma Pessoa presencialmente.',
    });
  }
  if (access.credentialClaim) {
    institutionalLinks.push({
      href: '/credenciais/reivindicacoes',
      label: 'Reivindicações de credencial',
      description: 'Aprove reivindicações de Pessoas pré-cadastradas.',
    });
  }
  if (access.permissions) {
    institutionalLinks.push({
      href: '/permissoes',
      label: 'Permissões delegadas',
      description: 'Gerencie delegações a voluntários.',
    });
  }
  if (institutionalLinks.length > 0) {
    groups.push({ title: 'Institucional', links: institutionalLinks });
  }

  return groups;
}
