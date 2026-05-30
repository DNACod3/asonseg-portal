# Expectations — USP-033: Manifestar interesse em serviço

**Origem:** AC-033-1 a AC-033-3 do PRD v0.3, ajustados e estendidos.

## 1. Cenários de sucesso testáveis

- **E-001:** WHEN a Pessoa autenticada clica em "entrar em contato" em um serviço ativo, the system SHALL — em transação única — persistir a manifestação, ativar o papel cliente se ainda não ativo (com captura do consentimento da finalidade 4 conforme USP-011), exibir o contato do prestador, e enviar e-mail ao prestador (USP-044) avisando do interesse.

  *Ajuste do AC-033-1:* explicita atomicidade dos 4 efeitos colaterais (toca F4 do intent).

- **E-002:** WHEN o cliente ainda não tem papel "cliente de serviço" ativo, the system SHALL exibir o termo curto da finalidade 4 e exigir aceite explícito (não apenas clique no botão de contato) antes de prosseguir.

  *Ajuste do AC-033-2:* explicita aceite explícito como precondição (toca F1 do intent + USP-011/P-002).

- **E-003:** The system SHALL permitir múltiplas manifestações simultâneas em serviços diferentes.

- **E-004:** WHEN o cliente fez N manifestações em janela curta, the system SHALL alertar o coordenador para análise de manifestação em massa.
  ✅ RESOLVIDO (dono do intent): N = 10 manifestações/semana → alerta operacional ao coordenador (tunável).

## 2. Proibições (must-not)

- **P-001 (toca F1 — consentimento sem o cliente perceber):** O sistema NÃO PODE ativar o papel cliente e revelar contato sem **exibir o termo da finalidade 4** e exigir aceite explícito (checkbox ou clique em "aceito") visível antes da revelação. Modal rápido sem leitura é violação ADR-0013.

- **P-002 (toca F2 — manifestação em massa):** O sistema NÃO PODE deixar cliente manifestar interesse em volume manifestamente anômalo sem fricção (rate limit + alerta operacional). Risco proposto análogo a USP-025/F3.

- **P-003 (toca F4 — atomicidade quebrada):** O sistema NÃO PODE deixar a manifestação em estado parcial (papel ativado sem manifestação persistida, contato revelado sem e-mail enviado, etc.). Falha em qualquer efeito aborta o conjunto com retry específico para o e-mail.

- **P-004 (toca F5 — contato exposto pós-cancelamento):** O sistema NÃO PODE deixar visibilidade recíproca (contato do prestador para o cliente, e do cliente para o prestador) ativa após cancelamento, sem decisão jurídica clara.
  ✅ RESOLVIDO (dono do intent / cf. USP-026): contato some das ativas; histórico já visto permanece com o prestador.

- **P-005:** O sistema NÃO PODE permitir manifestação em serviço fora do status "ativo".

- **P-006:** O sistema NÃO PODE permitir manifestação por Pessoa não autenticada — nem para "guardar e finalizar depois".

## 3. Limites

- **L-001 (Performance):** Submit ≤ 2s p95.
- **L-002 (E-mail ao prestador):** Entregue ao SMTP em ≤ 60s.
- **L-003 (Rate limiting):** Máximo de manifestações por cliente por janela.
- **L-004 (Auditoria):** Log imutável da manifestação retido conforme ADR-0008.

## 4. Critérios de pronto, do ponto de vista do dono do intent

- **D-001 (gate jurídico — BLOQUEANTE):** Antes desta USP ir para produção, **D-001 + D-002 do PRD** confirmam: (a) DPO designado; (b) termo da finalidade 4 (contratação de serviço) aprovado pelo jurídico; (c) modelo de exibição do termo (modal vs página) validado. Sem isso, USP fica em gate.

- **D-002:** Pessoa autenticada (sem papel cliente prévio), em ensaio, manifesta interesse pela primeira vez; vê o termo da finalidade 4; aceita explicitamente; contato do prestador é revelado; e-mail chega ao prestador. Total ≤ 30s.

- **D-003:** Em segunda manifestação (mesma Pessoa, outro serviço): termo da finalidade 4 **não aparece de novo** (já ativo) e o fluxo é direto.

- **D-004:** Em teste de race condition (cliques duplos): sistema persiste **uma única manifestação** + mensagem clara.

- **D-005:** Em teste de manifestação em massa: cliente faz N+1 manifestações em janela < acordada; sistema alerta operacionalmente.

- **D-006:** A AS abre auditoria de uma manifestação e confere o consentimento da finalidade 4 vinculado (versão+data+IP).
