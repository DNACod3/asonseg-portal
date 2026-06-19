/**
 * USP-017 — Validar Empresa na primeira vaga publicada — facts RED
 *
 * Fonte da verdade: expectations-USP-017.md (E-001..E-004, P-001..P-005, L-001/L-002).
 * Estes testes existem ANTES da implementação (P1). Devem reportar "red" por ausência de
 * implementação — nunca por erro de sintaxe/import. A fase Execute move/conecta cada it
 * para o __tests__/ do módulo dono (moderation/companies) e preenche o corpo.
 *
 * Rastreabilidade: cada it cita o AC (@ac-017-N). Slicing por sub-task no nome.
 */
import { describe, it, expect } from 'vitest';

describe('USP-017 · #156 backend — verificação da Empresa (side-effect atômico)', () => {
  // E-002 — aprovar 1ª vaga marca Empresa verificada na MESMA transação
  it.todo('AC-017-2: aprovar a 1ª vaga seta isVerified=true + verifiedAt + verifiedByPersonId + verificationJobId');
  it.todo('AC-017-2: grava verifiedSnapshot { cnpj, legalName, tradeName, address, phone, capturedAt }');
  it.todo('AC-017-2: emite COMPANY_VERIFIED no audit_log dentro do mesmo tx que ativa a vaga');
  it.todo('AC-017-2: se a verificação da Empresa falhar, a ativação da vaga faz rollback (ADR-0024 atomicidade)');

  // P-004 — dados vigentes, não do rascunho
  it.todo('AC-017-2/P-004: snapshot reflete os dados VIGENTES (editados via USP-015), não os do rascunho');

  // E-004 — idempotência / só 1ª vaga
  it.todo('AC-017-4: aprovar vaga de Empresa já verificada NÃO regrava verifiedAt nem re-snapshota (no-op)');
  it.todo('AC-017-4: aprovar vaga de Empresa já verificada NÃO emite novo COMPANY_VERIFIED');

  // E-003 — rejeição incrementa contador
  it.todo('AC-017-3: rejeitar vaga de Empresa não verificada incrementa rejectionCount em 1');
  it.todo('AC-017-3: rejeitar mantém isVerified=false e grava CONTENT_REJECTED com motivo');

  // P-005 — rota única (teste negativo / bypass D-004)
  it.todo('AC-017-P005/D-004: não existe rota fora do hook que sete isVerified=true (sem action de companies expondo o set)');
});

describe('USP-017 · #157 UI — painel de verificação na moderação', () => {
  // E-001 — painel + banner + checklist
  it.todo('AC-017-1: fila/moderação popula companyUnverified=true quando a Empresa da vaga é não verificada');
  it.todo('AC-017-1: painel exibe dados da Empresa em destaque + banner de 1ª vaga/edição');
  it.todo('AC-017-1: checklist interativa de verificação é exibida (itens marcáveis)');

  // P-001 — checklist obrigatória (must-not)
  it.todo('AC-017-P001: aprovação fica bloqueada enquanto itens da checklist não forem marcados (ou dispensados com motivo)');

  // P-002 — separação visual (must-not)
  it.todo('AC-017-P002: bloco "Verificação da Empresa" separado do bloco "Decisão da vaga", confirmações distintas');

  // P-003 / D-005 — histórico de rejeições visível (must-not)
  it.todo('AC-017-P003/D-005: histórico de rejeições (quantas, quando, quem, motivos) é exibido ao moderador');
  it.todo('AC-017-P003: Empresa rejeitada N vezes recebe tratamento especial visível (badge)');

  // E-004 — vaga subsequente
  it.todo('AC-017-4: Empresa já verificada exibe apenas "verificada em DD/MM/AAAA por Nome" e oculta o painel');

  // D-006 — diff de edição (re-verificação USP-015)
  it.todo('AC-017-D006: painel destaca campos alterados desde o snapshot da verificação anterior');
});

describe('USP-017 · NFR', () => {
  // L-001 — performance (medido em E2E/observabilidade; placeholder de fact)
  it.todo('AC-017-L001: painel de verificação carrega ≤ 3s p95 (validar em E2E/observabilidade)');
});
