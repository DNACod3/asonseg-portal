# Expectations — USP-029: Publicar serviço

**Origem:** AC-029-1 a AC-029-4 do PRD v0.3, ajustados e estendidos.

## 1. Cenários de sucesso testáveis

- **E-001:** WHEN o usuário inicia o cadastro de serviço, the system SHALL exigir escolha explícita entre "publicar como PF" (requer papel prestador ativo) ou "publicar em nome de [Empresa X]" (lista apenas Empresas em que a Pessoa é responsável ativa).

- **E-002:** WHEN o serviço é submetido com todos os campos obrigatórios (título, categoria do catálogo D-007, descrição, valor, unidade pré-definida do enum, região(ões), disponibilidade), the system SHALL persistir com status "em moderação", **com o consentimento da finalidade 3 ativo** para a Pessoa.

- **E-003:** The system SHALL permitir até 3 fotos do trabalho (JPG/PNG/WEBP, ≤5MB cada), opcionalmente.

- **E-004:** The system SHALL exibir, no cadastro, aviso explícito ao prestador PF sobre **exposição pública de nome** + texto sobre responsabilidade pelas fotos (sem PII de terceiros).

  *Ajuste:* AC do PRD não cobre aviso; vem dos F2/F3 do intent.

## 2. Proibições (must-not)

- **P-001 (toca F1 — serviço ilegal/fraudulento):** O sistema NÃO PODE permitir aprovação de serviço cuja categoria, descrição ou conteúdo viole **checklist textual de serviços proibidos** (agiotagem, remédios sem registro, serviços sem alvará/licença obrigatória, atividade ilegal).
  ❓ Checklist textual a entregar na Fase 0. (dono do intent — coordenador + jurídico)

- **P-002 (toca F2 — PF se passa por Empresa não cadastrada):** O sistema NÃO PODE permitir aprovação de serviço PF cuja descrição mencione "Empresa X" / "Loja Y" / "Equipe Z" sem que essa razão social esteja cadastrada como Empresa via USP-012. Moderador sanitiza ou rejeita.

- **P-003 (toca F3 — foto com PII de terceiros):** O sistema NÃO PODE deixar passar foto com padrões evidentes de PII (rosto sem consentimento, número de telefone visível, documento). Moderador inspeciona fotos como parte do USP-016.
  ✅ RESOLVIDO (ADR-0028): fotos passam por inspeção humana na moderação (sem OCR/blur automático de rostos no MVP); o sanitizer regex (e-mail/telefone/CPF/RG) cobre o texto livre.

- **P-004 (toca F4 — unidade ambígua):** O sistema NÃO PODE aceitar campo "unidade" como texto livre. Enum fechado obrigatório (por hora, por diária, por serviço, por mês, por orçamento).
  ✅ RESOLVIDO parte técnica (dono do intent): unidades em enum fechado. ❓ A lista final do enum permanece entregável de Fase 0 (catálogo D-007).

- **P-005 (toca F5 — race PF/Empresa):** O sistema NÃO PODE persistir serviço com estado "meio PF meio Empresa". Escolha é capturada no início e travada para o resto da transação; mudança requer cancelar e reiniciar.

- **P-006:** O sistema NÃO PODE permitir submissão de serviço por Pessoa sem papel prestador PF ativo (para publicar como PF) ou sem vínculo "responsável" ativo da Empresa (para publicar em nome dela).

- **P-007:** O sistema NÃO PODE expor contato (telefone/e-mail) do prestador na lista pública (USP-030) — apenas após manifestação de interesse (USP-033).

## 3. Limites

- **L-001 (Performance):** Submit ≤ 3s p95 (incluindo upload de fotos).
- **L-002 (Fotos):** Até 3, ≤5MB cada, formatos JPG/PNG/WEBP.
- **L-003 (Catálogo):** Categoria do enum D-007.
- **L-004 (Auditoria):** Log da submissão retido conforme ADR-0008.

## 4. Critérios de pronto, do ponto de vista do dono do intent

- **D-001 (gate operacional — BLOQUEANTE):** Antes desta USP ir para produção, **D-007 do PRD (catálogo de categorias)** está fechado, **a checklist textual de serviços proibidos** está validada com coordenador + jurídico, e **o termo da finalidade 3** está aprovado (D-002 do PRD). Sem essas três peças, não há critério objetivo para moderação.

- **D-002:** Prestador PF, em ensaio, publica serviço completo em ≤ 5 min com 2 fotos. Serviço aparece na fila do moderador (USP-016) com indicação clara "PF — primeiro serviço".

- **D-003:** Em teste de "PF se passando por Empresa": prestador escreve "Serviços da ACME" na descrição; sistema (ou moderador) bloqueia/sanitiza antes da publicação.

- **D-004:** Em teste de foto com PII: foto com documento visível é rejeitada (ou sanitizada) na moderação.

- **D-005:** Em teste de race PF/Empresa: tentativa de alterar o tipo no meio do cadastro é tratada (forçar reinício, ou bloquear) conforme decisão acordada.

- **D-006:** O coordenador inspeciona, em ensaio, a lista pública (USP-030) e confere que **nenhum serviço** revela telefone/e-mail do prestador.
