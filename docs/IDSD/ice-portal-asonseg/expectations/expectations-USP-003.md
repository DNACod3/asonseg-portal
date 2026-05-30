# Expectations — USP-003: Reivindicar credencial de Pessoa pré-cadastrada

**Origem:** AC-003-1 a AC-003-5 do PRD v0.3, ajustados e estendidos.

## 1. Cenários de sucesso testáveis

- **E-001:** WHEN o solicitante inicia a reivindicação informando CPF (ou identificador alternativo da Pessoa cadastrada por USP-002) e e-mail desejado, the system SHALL gerar uma solicitação pendente, vinculada à Pessoa pré-existente, **sem criar nova Pessoa**.

  *Ajuste do AC-003-1:* explicitado que a solicitação vincula-se à Pessoa existente, não cria nova.

- **E-002:** WHEN a verificação de identidade é confirmada por usuário com permissão "aprovar reivindicação de credencial" (item 9 do catálogo do Portal — USP-008), the system SHALL ativar a credencial, persistir os consentimentos eletrônicos das finalidades dos papéis ativados (com versão, data e IP), enviar e-mail de boas-vindas e gravar log de auditoria com solicitante, verificador, meio de verificação utilizado e data/hora.

  *Ajuste dos AC-003-3 e AC-003-5:* explicita a captura dos consentimentos eletrônicos no momento da ativação (a Pessoa que tinha aceite em papel passa a ter aceite eletrônico).

- **E-003:** IF o e-mail informado já está em uso por outra Pessoa, THEN the system SHALL bloquear a reivindicação com mensagem determinística.

- **E-004:** WHEN uma solicitação de reivindicação é criada, the system SHALL notificar os usuários com permissão de aprovação para que a fila não envelheça em silêncio.
  ✅ RESOLVIDO: notifica AS + coordenador; SLA ≤ 7 dias.

## 2. Proibições (must-not)

- **P-001 (toca F1 — sequestro de identidade):** O sistema NÃO PODE ativar credencial em nome de uma Pessoa pré-cadastrada sem que o **processo de verificação de identidade definido pela ASONSEG** (D-011 / QP-001) tenha sido executado e registrado em log com o meio utilizado. Verificação implícita ou conferência de campos básicos (nome + CPF) sozinha não basta.

- **P-002 (toca F2 — duplicação):** O sistema NÃO PODE criar nova Pessoa quando a reivindicação corresponde a uma Pessoa que já existe — mesmo quando a localização exigir comparação fuzzy de nome, ou identificador alternativo em vez de CPF.

- **P-003 (toca F3 — solicitação envelhecida):** O sistema NÃO PODE manter solicitação de reivindicação pendente sem que algum responsável da ASONSEG receba notificação. Solicitação criada que ninguém vê é falha de resultado.

- **P-004 (toca F4 — consentimento descolado):** O sistema NÃO PODE gravar o consentimento eletrônico da reivindicação em entidade diferente da Pessoa que está sendo ativada. O consentimento e a Pessoa ficam atomicamente vinculados na mesma transação.

- **P-005 (toca F5 — aprovação por papel errado):** O sistema NÃO PODE permitir que usuário sem a permissão específica "aprovar reivindicação de credencial" (item 9 do catálogo do Portal) aprove uma solicitação — nem por delegação implícita, nem por rota administrativa alternativa.

- **P-006:** O sistema NÃO PODE expor, no fluxo público de iniciar reivindicação, informações sobre se a Pessoa existe ou não no sistema (ex.: enumeration via CPF retornando mensagens distintas para "existe" vs "não existe"). Resposta deve ser genérica até a verificação acontecer.

## 3. Limites

- **L-001 (Performance):** Tempo de resposta do submit da solicitação ≤ 2s p95.
- **L-002 (Notificação):** Aprovador SHALL receber notificação da solicitação pendente em ≤ 5 minutos da criação.
- **L-003 (Validade do meio de verificação):** Quando o meio for por código por carta, código emitido tem validade ≤ N dias.
  ✅ RESOLVIDO: verificação manual pela AS via canal seguro (D-011); o rate limit de tentativas de reivindicação é parametrizável (ADR-0029).
- **L-004 (Visibilidade):** Solicitações pendentes SHALL ser visíveis apenas para usuários com permissão de aprovação (ADR-0017).

## 4. Critérios de pronto, do ponto de vista do dono do intent

- **D-001 (gate operacional/jurídico — BLOQUEANTE):** Antes desta USP ir para produção, **D-011 do PRD (meios de verificação de identidade)** e **QP-001** foram resolvidos: diretoria + AS definiram por escrito quais meios são aceitos (presencial, carta com código, confirmação da AS, ou combinação), com regras de quem pode aprovar e por qual meio. Sem essa decisão escrita, esta USP **não vai para produção** mesmo que o código esteja pronto — o risco de sequestro de identidade é inaceitável sem processo definido.

- **D-002:** Em ensaio: uma Pessoa cadastrada via USP-002 reivindica credencial, AS aprova pelo meio definido, e a Pessoa loga em seguida (USP-004). A mesma Pessoa aparece em USP-039 (visão consolidada) **com um único registro** — não duplicado.

- **D-003:** Em teste de bypass: terceira pessoa com dados básicos da Pessoa-alvo (nome, CPF) tenta reivindicar e a operação é bloqueada antes da aprovação porque o processo de verificação exige meio adicional. Validado pelo sponsor.

- **D-004:** A coordenadora visualiza a fila de solicitações pendentes e, em ensaio, processa uma. Confere que o log do verificador, meio e data/hora ficou gravado.

- **D-005:** Em teste com permissão errada: usuário com papel de assistente comum (sem item 9 do catálogo) tenta aprovar uma solicitação e é bloqueado com erro determinístico.
