import type { Role } from '@prisma/client';
import type { ConsentPurpose } from './purposes';

/**
 * Matriz declarativa de cascata de revogação (ADR-0025): finalidade → papel a
 * desativar quando o consentimento da finalidade é revogado.
 *
 * `null` = finalidade **sem papel vinculado** (acesso/feature, sem
 * `PersonRoleGrant` a cascatear — ex.: extração de CV, atendimento social,
 * encaminhamento). Para essas, a desativação é garantida on-read pelo
 * `requireActiveConsent` no ponto de uso (P-002 — sem janela de papel ativo
 * com consentimento revogado).
 *
 * Espelho inverso do `ROLE_PURPOSE_MAP` de `identity` (papel → finalidade),
 * estendido com as finalidades não-públicas. O **destino concreto** de
 * candidaturas/manifestações ativas é semântica de negócio a definir pela DPO
 * (gate preservado — F2/E-004 da USP-043); aqui fica apenas o vínculo papel↔finalidade.
 */
export const PURPOSE_ROLE_MAP: Record<ConsentPurpose, Role | null> = {
  PORTAL_ACCESS: null,
  JOB_APPLICATION: 'CANDIDATE',
  SERVICE_OFFERING: 'PROVIDER',
  SERVICE_HIRING: 'CLIENT',
  COMPANY_REPRESENTATION: 'COMPANY_RESPONSIBLE',
  SOCIAL_ASSISTANCE: null,
  CV_AI_EXTRACTION: null,
  SOCIAL_REFERRAL_TO_JOB: null,
};

/** Papel vinculado à finalidade (ou `null` se a finalidade não ativa papel). */
export function roleForPurpose(purpose: ConsentPurpose): Role | null {
  return PURPOSE_ROLE_MAP[purpose];
}
