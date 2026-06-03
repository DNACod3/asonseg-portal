import type { ConsentPurpose } from './purposes';

/**
 * Registro da versão **vigente** do termo de cada finalidade e o hash SHA-256
 * esperado do arquivo correspondente em `legal/consent-terms/<slug>/<version>.md`
 * (LGP-02 / issue #35).
 *
 * O hash esperado é a prova de integridade: o {@link loadTerm} recalcula o
 * SHA-256 do arquivo no disco e **bloqueia** o aceite se divergir deste valor
 * (defesa contra adulteração do texto fora do fluxo de versionamento — ADR-0009).
 *
 * Trocar o texto de um termo **exige nova versão** (`vN+1.md`) + novo hash aqui;
 * editar `v1.0.md` sem subir a versão é detectado como divergência e bloqueado.
 */
export interface TermRegistryEntry {
  readonly purpose: ConsentPurpose;
  /** Versão vigente no formato de arquivo (`v1.0`). */
  readonly currentVersion: string;
  /** SHA-256 (hex) do conteúdo íntegro do arquivo da versão vigente. */
  readonly expectedHash: string;
}

/**
 * Fonte da verdade da versão vigente + hash por finalidade.
 *
 * Os hashes abaixo são o `shasum -a 256` de cada `legal/consent-terms/<slug>/v1.0.md`.
 * O teste `terms-registry.int.test.ts` falha se o arquivo divergir, impedindo
 * que um termo seja alterado sem atualizar o registro.
 */
export const TERMS_REGISTRY: Record<ConsentPurpose, TermRegistryEntry> = {
  PORTAL_ACCESS: {
    purpose: 'PORTAL_ACCESS',
    currentVersion: 'v1.0',
    expectedHash: 'b9791c01cdf4cf5177d33a8938693671b97ab7f24293665f70024ea83006a0d2',
  },
  JOB_APPLICATION: {
    purpose: 'JOB_APPLICATION',
    currentVersion: 'v1.0',
    expectedHash: 'cba5ec9a519b6c5d2beab0adaf693252c87d95a9353877b9f3c43d41dfb064dd',
  },
  SERVICE_OFFERING: {
    purpose: 'SERVICE_OFFERING',
    currentVersion: 'v1.0',
    expectedHash: '9abdc14dbe425e0422987d5b5fc6002f942b90ac053c5d6a9b423640907a88a7',
  },
  SERVICE_HIRING: {
    purpose: 'SERVICE_HIRING',
    currentVersion: 'v1.0',
    expectedHash: 'cc05674f573f8ea3c5a50e1e731d7d929684a4ffb5d65f34d4bcc40d5d472803',
  },
  COMPANY_REPRESENTATION: {
    purpose: 'COMPANY_REPRESENTATION',
    currentVersion: 'v1.0',
    expectedHash: 'e72b433324098c03e7800f4e71b64605bf7153b914e24f869e74e944835e1200',
  },
  SOCIAL_ASSISTANCE: {
    purpose: 'SOCIAL_ASSISTANCE',
    currentVersion: 'v1.0',
    expectedHash: '6d15978756b5f6b943c977dfdf1f9fb0dbe492eae013f5f03069fce5ca4c2c6f',
  },
  CV_AI_EXTRACTION: {
    purpose: 'CV_AI_EXTRACTION',
    currentVersion: 'v1.0',
    expectedHash: '1b988046e2a8d82612dfac9b8b535c0908a222f15c9fe6d3cebd72eda0d2acdd',
  },
  SOCIAL_REFERRAL_TO_JOB: {
    purpose: 'SOCIAL_REFERRAL_TO_JOB',
    currentVersion: 'v1.0',
    expectedHash: '34e5c3019bba147558815979a068099399f119254f1e860ea6e794c584099f3e',
  },
};

/** Versão vigente do termo da finalidade (formato de arquivo, ex.: `v1.0`). */
export function currentTermVersion(purpose: ConsentPurpose): string {
  return TERMS_REGISTRY[purpose].currentVersion;
}

/**
 * Normaliza uma string de versão para o formato de arquivo `vN.M`.
 * Aceita tanto `v1.0` quanto o formato legado `job-application@v1.0`
 * (gravado por `acceptRoleConsent` no USP-001) extraindo o trecho `vN.M`.
 */
export function normalizeTermVersion(version: string): string {
  const match = /v\d+\.\d+/.exec(version);
  return match ? match[0] : version;
}

/**
 * `true` se a versão aceita (em qualquer formato) corresponde à versão vigente
 * da finalidade — base da checagem de "consentimento na versão atual" do
 * {@link requireActiveConsent} e do re-aceite por mudança major (E-005).
 */
export function isCurrentTermVersion(purpose: ConsentPurpose, acceptedVersion: string): boolean {
  return normalizeTermVersion(acceptedVersion) === currentTermVersion(purpose);
}
