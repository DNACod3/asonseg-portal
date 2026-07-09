import type { PersonApplicationRow } from '@/modules/jobs';
import type { PersonReferralRow } from '@/modules/referrals';
import type { ProviderServiceRow, PersonServiceInterestRow } from '@/modules/services';
import type { PersonCompanyGrantRow } from '@/modules/companies';
import { canViewConsolidatedPerson } from '../domain/consolidated-person';
import { canManageSocioeconomicRecord } from '../domain/socioeconomic-record';
import { getSocioeconomicRecord } from '../queries/get-socioeconomic-record';
import { viewPersonForStaff, type StaffPersonView } from './view-person-for-staff';
import type { SocioeconomicRecordView } from './view-socioeconomic-record';

/**
 * Dimensões cross-módulo já buscadas pela **página** (raiz de composição) e
 * passadas ao assembler como input tipado — `persons` **não importa** os
 * barrels `jobs`/`referrals`/`services`/`companies` em runtime (só os tipos,
 * `import type`, que são apagados na compilação — sem ciclo real, Assumption
 * #5 / lição AD-019: o barrel `@/modules/persons` arrasta Prisma p/ o bundle e
 * criaria import circular se `persons` importasse de volta esses módulos).
 */
export interface ConsolidatedExternalDimensions {
  applications: PersonApplicationRow[];
  referrals: PersonReferralRow[];
  servicesOffered: ProviderServiceRow[];
  serviceInterests: PersonServiceInterestRow[];
  companyGrants: PersonCompanyGrantRow[];
}

/**
 * Painel consolidado de uma Pessoa (USP-039 / SOC-06) — saída do assembler
 * `viewPersonForSocialAssistant`, **fonte única de anonimização** (AC-039-4).
 *
 * `ficha` só é populada quando o viewer é `SOCIAL_ASSISTANT`/`BOARD`
 * (barreira B2 do SOC-039-MN-01); para coordenador (ou qualquer não-AS/BOARD)
 * é sempre `null` — estruturalmente ausente do payload servido.
 */
export interface ConsolidatedPersonView {
  person: StaffPersonView;
  ficha: SocioeconomicRecordView | null;
  applications: PersonApplicationRow[];
  referrals: PersonReferralRow[];
  servicesOffered: ProviderServiceRow[];
  serviceInterests: PersonServiceInterestRow[];
  companyGrants: PersonCompanyGrantRow[];
}

/**
 * Monta a visão consolidada de uma Pessoa para AS/diretoria/coordenador
 * (USP-039 / SOC-06, SOC-039-MN-01, SOC-039-MN-02). Fonte única de
 * anonimização do painel (AC-039-4) — nenhuma outra camada decide o que sai.
 *
 * Sequência:
 *  1. **SOC-039-MN-02** (defesa em profundidade — a rota já negou): viewer sem
 *     papel de {@link canViewConsolidatedPerson} → `null`, nenhuma dimensão
 *     buscada/serializada.
 *  2. Identidade via {@link viewPersonForStaff} (reuso) — Pessoa inexistente →
 *     `null`.
 *  3. **B1 do SOC-039-MN-01:** só chama {@link getSocioeconomicRecord} (que já
 *     é role-gated + audit-on-read) quando
 *     {@link canManageSocioeconomicRecord} (AS/BOARD) autoriza. Para
 *     coordenador, o read **não é chamado** — os campos sensíveis nunca são
 *     SELECIONADOS do banco.
 *  4. Retorna `{ person, ficha, ...dimensions }` — **B2 do SOC-039-MN-01:**
 *     `ficha` só é populada no ramo AS/BOARD; caso contrário `null` (strip
 *     estrutural, redundante mesmo se B1 falhasse).
 *
 * Nunca lança (a leitura da ficha já não lança — `getSocioeconomicRecord`
 * retorna `ActionResult`; erro nela degrada para `ficha=null` sem quebrar o
 * painel, já que o restante das dimensões continua útil).
 */
export async function viewPersonForSocialAssistant(
  personId: string,
  viewer: { roles: readonly string[] },
  dimensions: ConsolidatedExternalDimensions,
): Promise<ConsolidatedPersonView | null> {
  // SOC-039-MN-02: guarda ANTES de qualquer busca — nenhuma dimensão é
  // carregada/serializada para quem não tem papel autorizado.
  if (!canViewConsolidatedPerson(viewer.roles)) {
    return null;
  }

  const person = await viewPersonForStaff(personId);
  if (!person) {
    return null;
  }

  // B1 (SOC-039-MN-01): SELECT condicional ao papel — para coordenador (ou
  // qualquer não-AS/BOARD autorizado ao painel), `getSocioeconomicRecord`
  // NUNCA é chamado, então os campos sensíveis nunca são SELECIONADOS do banco
  // nem entram no payload RSC/Flight.
  let ficha: SocioeconomicRecordView | null = null;
  if (canManageSocioeconomicRecord(viewer.roles)) {
    const result = await getSocioeconomicRecord(personId);
    ficha = result.ok ? result.data : null;
  }

  // B2 (SOC-039-MN-01): strip estrutural — `ficha` só existe no ramo AS/BOARD
  // (reforço mesmo que B1 falhasse).
  return {
    person,
    ficha,
    applications: dimensions.applications,
    referrals: dimensions.referrals,
    servicesOffered: dimensions.servicesOffered,
    serviceInterests: dimensions.serviceInterests,
    companyGrants: dimensions.companyGrants,
  };
}
