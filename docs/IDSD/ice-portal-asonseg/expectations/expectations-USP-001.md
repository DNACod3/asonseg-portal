# Expectations — USP-001: Auto-cadastro de Pessoa no portal (público)

**Origem:** AC-001-1 a AC-001-7 do PRD MVP Portal v0.3, ajustados e estendidos.

## 1. Cenários de sucesso testáveis

- **E-001 (cadastro — TX1):** WHEN o visitante submete nome, CPF formalmente válido, e-mail não usado por outra Pessoa, senha que satisfaz a política, CAPTCHA aprovado, ao menos um papel público escolhido e aceite do termo de **PORTAL_ACCESS**, the system SHALL persistir, em **transação única**, Pessoa + credencial + papel escolhido em `AWAITING_CONSENT` + consentimento PORTAL_ACCESS (versão do termo, data e IP), enfileirar o e-mail de boas-vindas (outbox) e gravar log de auditoria. A Pessoa fica autenticável; o papel ainda **não** está ativo.

- **E-001b (ativação do papel — TX2):** WHEN, na tela pós-cadastro, o visitante aceita explicitamente o termo da **finalidade do papel** escolhido, the system SHALL persistir, em **transação única**, o consentimento da finalidade (versão do termo, data e IP) **e** ativar o papel (`AWAITING_CONSENT → ACTIVE`), gravando auditoria — mesmo padrão da USP-006. O papel nunca chega a `ACTIVE` fora dessa transação.

  *Ajuste do AC-001-1 e AC-001-6:* atomicidade explicitada em **duas transações** (modelo lazy — o consentimento da finalidade ganha tela dedicada, evitando aceite não-informado embutido no formulário de cadastro); versão do termo + IP na evidência de consentimento (ADR-0013).

- **E-002:** WHEN o cadastro conclui com sucesso, the system SHALL redirecionar o visitante para uma tela de **próximo passo específico do papel ativado** (ex.: cadastro de CV se papel candidato; cadastro de prestador PF se prestador). Não cair em home genérica.

  *Ajuste:* AC do PRD não exige tela de próximo passo específico; vem do cenário de sucesso operacional do intent.

- **E-003:** IF o e-mail informado já está em uso por outra Pessoa, THEN the system SHALL bloquear o cadastro com mensagem determinística informando o conflito de e-mail.

- **E-004:** IF o CPF informado já está em uso por outra Pessoa, THEN the system SHALL bloquear o cadastro com mensagem determinística informando o conflito de CPF (sem expor a Pessoa pré-existente).

- **E-005:** IF o CPF tem formato/dígito verificador inválido, THEN the system SHALL bloquear o cadastro antes de tocar persistência.

- **E-006:** WHERE dois submits chegam simultaneamente com o mesmo CPF (ou o mesmo e-mail), the system SHALL persistir uma única Pessoa e retornar **erro determinístico (HTTP 409 ou equivalente)** para o segundo submit — nunca 500, nunca duplicidade silenciosa.

  *Extensão dos AC-001-2/3:* explicita comportamento sob concorrência (toca F1 do intent).

- **E-007:** The system SHALL armazenar senhas com **bcrypt** via Supabase Auth — a senha em claro nunca passa pelo código da aplicação (delegada ao SDK/`auth.admin.createUser`; o provedor faz o hash).
  ✅ **Resolvido** (TD §7) — Supabase Auth usa **bcrypt** (hash observado no formato `$2y$10$…`, cost factor **10**, gerenciado pelo provedor e **não exposto** como ajuste do cliente). Meta verificável: senha persistida como hash bcrypt do Supabase Auth; algoritmo legado/texto-claro impossível por construção (reforça P-003). _Nota: o TD não deve afirmar "cost ≥12" — não é configurável com Supabase Auth; ver §7 corrigida._ (técnico)

## 2. Proibições (must-not)

- **P-001 (toca F1 — race condition):** O sistema NÃO PODE criar duas Pessoas com mesmo CPF nem duas Pessoas com mesmo e-mail, mesmo sob submits simultâneos. Equivalente operacional: unique constraint no banco + tratamento determinístico do conflito (409 no segundo submit, nunca 500, nunca persistência dupla).

- **P-002 (toca F2 — papel sem consentimento):** O sistema NÃO PODE ativar nenhum papel público antes do consentimento da finalidade correspondente estar persistido **na mesma transação da ativação** — versão do termo, data e IP. Nem por um milissegundo. Se a persistência do consentimento da finalidade falhar, o papel **não fica ativo** (permanece `AWAITING_CONSENT`). A Pessoa pode existir, autenticável, com o consentimento PORTAL_ACCESS persistido na TX1 — mas sem o papel ativo (modelo lazy, ver E-001/E-001b).

- **P-003 (toca F3 — senha):** O sistema NÃO PODE armazenar senha em texto claro nem com algoritmo legado (MD5, SHA-1, ou qualquer hash sem salt). Nenhuma rota administrativa pode contornar essa regra.

- **P-004 (toca F4 — e-mail prematuro):** O sistema NÃO PODE enviar e-mail de boas-vindas antes da confirmação de persistência da Pessoa. Em caso de falha posterior, a Pessoa não pode existir e o e-mail não pode ter sido enviado.

- **P-005 (toca F5 — CAPTCHA bypass):** O sistema NÃO PODE aceitar submit de auto-cadastro sem validação de CAPTCHA aprovada — inclusive via chamada direta à API, sem passar pelo formulário web.

- **P-006 (toca F6 — log silencioso):** O sistema NÃO PODE deixar de gravar log de auditoria de um cadastro que persistiu Pessoa. Falha na auditoria invalida a transação ou dispara alerta operacional imediato; não fica silenciosa.

- **P-007 (toca F7 — marca de exceção):** O sistema NÃO PODE permitir que o fluxo público de auto-cadastro grave a marca "Pessoa sem documento — exceção" no cadastro. Essa marca só pode ser gravada pelo fluxo da AS via USP-002.

- **P-008:** O sistema NÃO PODE revelar, em mensagem de erro pública, a existência ou inexistência de uma Pessoa por meio de combinação de tentativas (ex.: enumeration via e-mail vs CPF retornando mensagens distintas que possibilitem inferência).

## 3. Limites

- **L-001 (Performance):** Tempo de resposta do submit ≤ 2s p95 (§6.1 do PRD).
- **L-002 (E-mail):** Boas-vindas entregue (no SMTP, não no inbox final) em ≤ 60s após confirmação da transação.
- **L-003 (Rate limiting):** Máximo **3 submissões de auto-cadastro por IP por janela de 15 minutos** (N=3, M=15) antes de exigir desafio adicional ou bloqueio temporário.
  ✅ **Resolvido** (ADR-0029 / TD §8) — N=3, M=15min. Mecanismo: contadores persistidos (rate limit por rota + lockout `(email,IP)`) conforme ADR-0029; números parametrizados e ajustáveis sem mudança estrutural. O CAPTCHA (ADR-0029) é o gate anti-bot primário do cadastro. (técnico)
- **L-004 (Retenção):** Tentativas de cadastro falhas (`auth_attempts`) retidas por **90 dias**, depois expurgadas por job agendado. Janela **parametrizável** via env (`AUTH_ATTEMPTS_RETENTION_DAYS`, default 90) para ajuste sem mudança de schema.
  ✅ **Resolvido** (project-guideline §11 / TD §7) — 90 dias por default, configurável. Janela própria (mais curta que os 2 anos dos logs operacionais e que a retenção indefinida do `audit_log`/`consents`) porque `auth_attempts` carrega PII (IP + e-mail) e a finalidade anti-bot não exige histórico longo — alinhado à minimização LGPD (ADR-0008). (dono do intent + técnico)
- **L-005 (Segurança):** TLS obrigatório em toda a operação (§6.3 do PRD).

## 4. Critérios de pronto, do ponto de vista do dono do intent

- **D-001:** Uma Pessoa real da comunidade (fora do time Bravi), em celular de baixo desempenho com conexão 4G modesta, conclui o auto-cadastro do início ao fim em < 3 minutos sem ajuda externa. Validado com ≥ 3 testes desse tipo, com no mínimo 1 papel público diferente em cada.

- **D-002:** Em janela de teste de carga sintética simulando 10 submits simultâneos com o mesmo CPF, **zero Pessoas duplicadas** e mensagem de erro determinística no segundo submit em diante. Mesmo teste repetido com mesmo e-mail.

- **D-003:** O painel pós-cadastro mostra próximo passo claro para o papel ativado (cadastro CV para candidato, cadastro prestador para prestador, etc.) — verificado por papel, por inspeção do sponsor.

- **D-004 (gate jurídico):** Antes desta USP ir para produção, **D-002 do PRD (termos por finalidade)** está concluído e os termos das finalidades dos quatro papéis públicos foram revisados e aprovados pelo jurídico/diretoria por escrito. Sem isso, esta USP **não vai para produção** mesmo que o código esteja pronto — ela viola ADR-0013 por padrão.

- **D-005 (gate operacional):** A AS consegue, em ensaio com voluntário, abrir a auditoria de uma Pessoa recém-cadastrada e ver os campos esperados (Pessoa, IP, versão do termo, data, papel ativado, consentimento).

- **D-006:** Em teste de bypass: tentativa de chamada direta à API de cadastro sem CAPTCHA é rejeitada com erro determinístico. Validado por engenheiro Bravi e por inspeção do log.
