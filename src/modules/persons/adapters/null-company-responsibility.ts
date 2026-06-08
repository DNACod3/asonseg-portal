import type {
  CompanyResponsibilityPort,
  OrphanedCompanyRef,
} from '../ports/companyResponsibility';

/**
 * Adapter padrão de {@link CompanyResponsibilityPort} enquanto o módulo
 * `companies` (Empresa + vínculos de responsável) não existe — ele chega em
 * USP-010..014.
 *
 * Sem modelo de Empresa no schema, **nenhuma Pessoa pode ser responsável de
 * Empresa**, então a inativação nunca deixaria uma Empresa órfã: retorna sempre
 * vazio. O invariante P-002 fica satisfeito de forma vacuamente verdadeira, e o
 * seam permanece pronto — quando `companies` chegar, ele troca este binding no
 * `shared/container.ts` pelo adapter real (que consulta os grants de Empresa) e
 * a Server Action de inativação passa a bloquear sem nenhuma alteração própria.
 */
export class NullCompanyResponsibilityAdapter implements CompanyResponsibilityPort {
  async companiesLeftWithoutResponsible(): Promise<OrphanedCompanyRef[]> {
    return [];
  }
}
