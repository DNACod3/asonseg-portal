# Expectations — USP-036: Cadastrar ficha socioeconômica da Pessoa

**Origem:** AC-036-1 a AC-036-3 do PRD v0.3, ajustados e estendidos.

## 1. Cenários de sucesso testáveis

- **E-001:** WHEN a assistente social acessa o cadastro social de uma Pessoa **com consentimento ativo da finalidade 6** (atendimento social), the system SHALL exibir os campos: renda aproximada, benefício social recebido, situação de moradia, composição familiar declarada — esta última como **enum semi-estruturado** (qtd crianças, qtd adultos, qtd idosos) + texto livre opcional.

  *Ajuste do AC-036-1:* explicita gate de consentimento + semi-estrutura na composição familiar (toca F5 do intent).

- **E-002:** The system SHALL permitir editar a qualquer momento e registrar log das alterações com **justificativa textual obrigatória** com conteúdo mínimo significativo.

  *Ajuste do AC-036-2:* explicita justificativa obrigatória (toca F4 do intent).

- **E-003:** The system SHALL impedir o acesso aos dados sociais por qualquer Pessoa que não tenha papel AS ou diretoria. Coordenador NÃO vê; voluntário NÃO vê.

- **E-004:** WHEN uma Pessoa é cadastrada via USP-002 (sem CPF, com exceção) e posteriormente reconciliada com USP-001 (CPF obtido), the system SHALL preservar a ficha social vinculada à Pessoa (ID interno), sem perda ou duplicação.

  *Ajuste:* AC do PRD não cobre reconciliação; vem do F6 do intent.

## 2. Proibições (must-not)

- **P-001 (toca F1 — sem DPO):** O sistema NÃO PODE permitir cadastro/edição de ficha social em produção sem DPO designado (D-001 do PRD). Sem DPO, tratamento de dado sensível fica em violação LGPD direta.

- **P-002 (toca F2 — consentimento da finalidade 6 ausente):** O sistema NÃO PODE permitir cadastro de ficha social em Pessoa sem consentimento ativo da finalidade 6 (eletrônico via USP-043, ou evidência de termo em papel registrado via USP-002).

- **P-003 (toca F3 — coordenador/voluntário vê):** O sistema NÃO PODE permitir, por nenhuma rota (UI, API direta, JSON serializado de USP-039), que coordenador ou voluntário tenha acesso aos campos da ficha social. Guard centralizado, testado por papel.

- **P-004 (toca F4 — log sem justificativa):** O sistema NÃO PODE aceitar edição de ficha social sem justificativa textual de conteúdo mínimo. "X", "—", "alteração" não bastam.

- **P-005 (toca F5 — texto livre incoerente):** O sistema NÃO PODE deixar a composição familiar **apenas** como texto livre — semi-estrutura mínima reduz inconsistência entre AS.

- **P-006:** O sistema NÃO PODE expor a ficha social em relatórios não autorizados (USP-042 sem permissão), nem em exportação para terceiros.

- **P-007:** O sistema NÃO PODE armazenar ficha social em texto claro no banco — criptografia em repouso obrigatória (RNF 6.3).

## 3. Limites

- **L-001 (Performance):** Submit ≤ 2s p95.
- **L-002 (Visibilidade):** Restrita a AS e diretoria por todo o sistema (lookup centralizado).
- **L-003 (Criptografia em repouso):** Dados sensíveis sociais armazenados criptografados.
- **L-004 (Retenção):** Conforme ADR-0008 (retenção indefinida com base institucional). Revogação da finalidade 6 (USP-043) desativa o tratamento ativo mas não exclui histórico.

## 4. Critérios de pronto, do ponto de vista do dono do intent

- **D-001 (gate compliance LGPD — BLOQUEANTE):** Antes desta USP ir para produção, **D-001 do PRD (DPO designado)** está confirmado por escrito. Sem DPO, esta USP **não vai para produção** — RP-002 inaceitável.

- **D-002 (gate jurídico — BLOQUEANTE):** Antes desta USP ir para produção, **D-002 do PRD (termo da finalidade 6)** está aprovado pelo jurídico. Sem termo, RP-003 inaceitável; a USP **não vai para produção**.

- **D-003:** A AS, em ensaio com voluntário simulando atendimento, abre ficha social, preenche, salva em ≤ 3 min. Log registra autora + data + campos + justificativa.

- **D-004:** Em teste de visibilidade: coordenador faz login e tenta abrir a ficha social de uma Pessoa por URL direta; sistema bloqueia com 403 + log da tentativa.

- **D-005:** Em teste de edição: AS edita renda; sistema exige justificativa; tentativa com "x" é rejeitada; com "Pessoa relatou aumento de salário após contratação na vaga X" aceita.

- **D-006:** Em teste de reconciliação: Pessoa cadastrada via USP-002 sem CPF tem ficha social criada; depois CPF chega e Pessoa é atualizada; ficha permanece vinculada.

- **D-007:** A coordenadora abre a Pessoa em USP-039 e confere que **não vê** os campos da ficha social (visibilidade restrita).
