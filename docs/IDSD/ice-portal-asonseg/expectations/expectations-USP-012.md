# Expectations — USP-012: Cadastro de Empresa (pela Pessoa que se torna responsável)

**Origem:** AC-012-1 a AC-012-4 do PRD v0.3, ajustados e estendidos.

## 1. Cenários de sucesso testáveis

- **E-001:** WHEN a Pessoa autenticada submete o cadastro de Empresa com CNPJ, razão social, nome fantasia e setor (todos obrigatórios), e aceita o termo da finalidade 5 (representação de empresa), the system SHALL persistir a Empresa, criar o vínculo Pessoa↔Empresa do tipo "responsável", **ativar o papel empresa-responsável na Pessoa** (se ainda não estiver ativo) com o consentimento da finalidade 5 — tudo em transação única.

  *Ajuste do AC-012-1:* explicita atomicidade Empresa + vínculo + papel + consentimento.

- **E-002:** IF o CNPJ tem formato/dígito verificador inválido, THEN the system SHALL bloquear o cadastro antes de tocar persistência.

- **E-003:** IF o CNPJ já está cadastrado no portal, THEN the system SHALL bloquear o cadastro e oferecer fluxo de "solicitar inclusão como responsável" à Pessoa logada, notificando os responsáveis atuais.

- **E-004:** WHEN a Empresa é persistida com sucesso, the system SHALL marcá-la com flag "não verificada" e impedir que ela apareça em qualquer listagem pública (home, busca) até USP-017 aprovar.

  *Ajuste do AC-012-4:* explicita ocultação até verificação (não apenas marcação).

## 2. Proibições (must-not)

- **P-001 (toca F1 — empresa-fantasma):** O sistema NÃO PODE permitir que Empresa "não verificada" apareça em listagens públicas (home, busca de vagas, busca de serviços, indicadores agregados). Defesa principal contra RP-005 acontece em USP-017, mas a ocultação aqui é precondição.

- **P-002 (toca F2 — aquisição hostil via inclusão como responsável):** O sistema NÃO PODE concluir "solicitação de inclusão como responsável" sem aprovação explícita de pelo menos um responsável atual ativo da Empresa, dentro de prazo definido. Default em silêncio (sem resposta) é negativa, **não positiva**.
  ✅ RESOLVIDO (dono do intent): prazo de 7 dias; default = expira negado.

- **P-003 (toca F3 — edição contornando verificação):** O sistema NÃO PODE permitir edição de CNPJ, razão social ou nome fantasia (USP-015) sem disparar nova verificação (revogação da flag "verificada" + nova validação manual na próxima vaga). Nenhuma rota administrativa pode pular esse re-gate.

- **P-004 (toca F4 — atomicidade quebrada):** O sistema NÃO PODE persistir Empresa sem o vínculo Pessoa↔Empresa correspondente, nem o vínculo sem o papel empresa-responsável ativo na Pessoa, nem qualquer combinação sem o consentimento da finalidade 5. Falha em qualquer ponta aborta a transação inteira.

- **P-005 (toca F5 — vazamento da Pessoa-responsável):** O sistema NÃO PODE exibir, em telas públicas da Empresa (página da Empresa, detalhe de vaga, busca de serviços), o nome ou dados pessoais da Pessoa-responsável. ADR-0017: dados corporativos da Empresa são públicos; dados da Pessoa por trás são restritos.

- **P-006:** O sistema NÃO PODE permitir que duas Empresas com mesmo CNPJ coexistam no portal, nem sob submissões simultâneas (race condition).

- **P-007:** O sistema NÃO PODE permitir cadastro de Empresa por Pessoa sem credencial (USP-002 sem USP-003). Empresa-responsável requer login.

## 3. Limites

- **L-001 (Performance):** Submit ≤ 2s p95.
- **L-002 (Visibilidade — ADR-0017):** Nome da Pessoa-responsável **não aparece** em telas públicas da Empresa.
- **L-003 (Ocultação até verificação):** Empresa "não verificada" não aparece em nenhuma busca pública.

## 4. Critérios de pronto, do ponto de vista do dono do intent

- **D-001:** Uma Pessoa real, em ensaio, cadastra uma Empresa em ≤ 3 minutos. Empresa não aparece na home pública (USP-041) nem na busca de vagas (USP-021) até a verificação manual em USP-017.

- **D-002:** Em teste de race condition: dois submits simultâneos com mesmo CNPJ resultam em **uma única Empresa** e erro determinístico no segundo (toca P-006).

- **D-003 (gate jurídico):** Antes desta USP ir para produção, o termo da **finalidade 5 (representação de empresa)** está aprovado pelo jurídico via D-002 do PRD. Sem isso, **não vai para produção**.

- **D-004:** Em ensaio com CNPJ duplicado: a Pessoa submete o fluxo de "solicitar inclusão"; o responsável atual da Empresa recebe notificação clara; sem aprovação dele, a Pessoa não vira responsável.

- **D-005:** A coordenadora inspeciona a página pública de uma Empresa cadastrada e confere que **nenhum dado pessoal da Pessoa-responsável aparece**.

- **D-006:** Em teste de bypass: tentativa de chamada direta à API marcando "verificada=true" no momento do cadastro é rejeitada (apenas USP-017 pode marcar verificada).
