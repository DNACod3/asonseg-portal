import type { PublicRole } from '../schemas/registerPerson';

/**
 * Regras puras (sem IO) da ativação de papel adicional (USP-006).
 *
 * O ADR-0008 (pessoa unificada / papéis compostos) define que uma mesma Pessoa
 * pode acumular papéis sem entidades distintas. Ao ativar um papel novo, o sistema
 * pede **apenas os campos do perfil ainda não preenchidos** (E-001 / intent §2) —
 * daqui sai a lista de campos faltantes que a UI renderiza e a action exige.
 */

/**
 * Campos de perfil (no nível da Pessoa) que compõem o perfil mínimo de um papel
 * público. Outros dados específicos de cada papel (currículo, dados de prestador)
 * são coletados nas USPs downstream (USP-009/010), não aqui — minimização LGPD.
 */
export const PROFILE_FIELDS = ['phone', 'fullAddress'] as const;
export type ProfileField = (typeof PROFILE_FIELDS)[number];

/**
 * Campos obrigatórios do perfil por papel público. A ativação só pede os que
 * ainda estiverem vazios na Pessoa (a Pessoa não repreenche o que já existe).
 */
export const ROLE_PROFILE_FIELDS = {
  CANDIDATE: ['phone', 'fullAddress'],
  PROVIDER: ['phone', 'fullAddress'],
  CLIENT: ['phone'],
} as const satisfies Record<PublicRole, readonly ProfileField[]>;

/** Rótulos PT-BR dos papéis públicos (UI + mensagens de erro). */
export const ROLE_LABELS: Record<PublicRole, string> = {
  CANDIDATE: 'Candidato(a)',
  PROVIDER: 'Prestador(a) de serviços',
  CLIENT: 'Cliente',
};

/** Metadados de cada campo de perfil para renderização do formulário (E-001). */
export const PROFILE_FIELD_META: Record<
  ProfileField,
  { label: string; type: string; autoComplete: string; placeholder: string }
> = {
  phone: {
    label: 'Telefone',
    type: 'tel',
    autoComplete: 'tel',
    placeholder: '(11) 90000-0000',
  },
  fullAddress: {
    label: 'Endereço completo',
    type: 'text',
    autoComplete: 'street-address',
    placeholder: 'Rua, número, bairro, cidade',
  },
};

/**
 * Próximo passo do papel recém-ativado (E-004). As telas específicas de cada
 * papel chegam nas USPs downstream (CV — USP-009, prestador — USP-010, serviços);
 * até lá o próximo passo aponta para o perfil, de onde o fluxo do papel continua.
 */
export const ROLE_NEXT_STEP: Record<PublicRole, string> = {
  CANDIDATE: '/perfil',
  PROVIDER: '/perfil',
  CLIENT: '/perfil',
};

/** Subconjunto da Pessoa necessário para decidir os campos faltantes. */
export interface ProfileSnapshot {
  phone?: string | null;
  fullAddress?: string | null;
}

/** `true` se o valor do campo está ausente (null/undefined/vazio após trim). */
function isEmpty(value: string | null | undefined): boolean {
  return value == null || value.trim() === '';
}

/**
 * Campos obrigatórios do papel que ainda **não estão preenchidos** na Pessoa.
 * É a fonte única tanto da UI (quais inputs exibir) quanto da action (quais
 * exigir) — garante que UI e servidor concordem sobre "campos faltantes".
 */
export function missingProfileFields(person: ProfileSnapshot, role: PublicRole): ProfileField[] {
  return ROLE_PROFILE_FIELDS[role].filter((field) => isEmpty(person[field]));
}
