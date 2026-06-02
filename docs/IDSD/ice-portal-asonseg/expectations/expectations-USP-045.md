# Expectations — USP-045: Reativação de Pessoa inativada (fluxo inverso da USP-007)

**Origem:** derivada da USP-007 (fluxo inverso) + ADR-0030. Não há AC-045 no PRD v0.3; ACs próprios derivados das decisões registradas (a refletir no PRD v0.4).

## 1. Cenários de sucesso testáveis

- **E-001:** WHEN um usuário autorizado (permissão **igual ou superior** à de quem inativou) reativa uma Pessoa inativa, the system SHALL reabilitar o login dessa Pessoa e registrar log imutável com responsável, motivo e data/hora.

- **E-002:** WHEN uma Pessoa é reativada, the system SHALL manter o histórico operacional íntegro (que nunca foi apagado — ADR-0008) e visível conforme as visões legítimas (USP-039).

- **E-003:** WHEN uma Pessoa é reativada, the system SHALL deixar a conta **sem papéis, permissões ou delegações restaurados** — quaisquer grants anteriores precisam ser reconcedidos explicitamente (USP-008).

  *Decisão "zera grants" (USP-007/D-006 + ADR-0030).*

- **E-004:** WHILE a Pessoa permanece reativada, the system SHALL passar a aceitar seus logins na próxima requisição dentro da janela de revalidação (≤ 30s — ADR-0030), sem ação manual sobre a sessão.

## 2. Proibições (must-not)

- **P-001 (toca F1 — privilégio restaurado):** O sistema NÃO PODE restaurar automaticamente papéis, permissões ou delegações que a Pessoa tinha antes da inativação — a reativação zera grants; a reconcessão é ato explícito e auditável (USP-008).

- **P-002 (toca F3 — hierarquia de permissão):** O sistema NÃO PODE permitir reativação por ator com permissão inferior à de quem realizou a inativação original, por nenhuma rota (UI, API, função administrativa) — USP-007/P-006 não admite exceção.

- **P-003 (toca F4 — consentimento LGPD):** O sistema NÃO PODE reinstaurar automaticamente consentimentos LGPD que estavam suspensos — eles exigem **re-aceite** pelo titular (ADR-0025). ❓ (DPO) validar o texto/fluxo do re-aceite antes de produção.

- **P-004 (toca F5 — rastreabilidade):** O sistema NÃO PODE concluir uma reativação sem registrar log imutável (quem reativou, motivo do catálogo, data/hora).

- **P-005 (toca F2 — reversão ineficaz):** O sistema NÃO PODE marcar uma Pessoa como reativada sem que o efeito (login aceito) se propague na janela de revalidação acordada — reativação sem efeito real é falha.

- **P-006 (toca F6 — inativação definitiva):** O sistema NÃO PODE reativar Pessoa cuja inativação seja de natureza irreversível, se essa categoria existir. ❓ (dono do intent) definir.

## 3. Limites

- **L-001 (Performance):** Submit da reativação ≤ 2s p95 (espelha USP-007/L-001).
- **L-002 (Janela de efeito):** Login volta a ser aceito em janela curta — alvo ≤ 30s, idealmente a cada requisição (ADR-0030).
- **L-003 (Auditoria):** Log de reativação imutável: responsável, motivo (catálogo), data/hora.
- **L-004 (Retenção):** Nenhuma recriação de dado — opera sobre histórico preexistente (ADR-0008).

## 4. Critérios de pronto, do ponto de vista do dono do intent

- **D-001:** A coordenadora que inativou um voluntário por engano consegue reativá-lo **sozinha** (sem ajuda da Bravi) em ≤ 30 segundos; na tentativa seguinte o voluntário loga.

- **D-002:** Após a reativação, o voluntário aparece **sem** os papéis/delegações antigos; a coordenadora reconcede o que for necessário de forma consciente.

- **D-003 (gate de permissão):** Em teste, um ator com permissão inferior à de quem inativou **não** consegue reativar — a operação é negada com mensagem clara.

- **D-004:** O histórico da Pessoa reativada permanece íntegro e visível nas visões legítimas (USP-039), antes e depois da reativação.

- **D-005 (gate catálogo):** O catálogo de motivos de reativação está definido (Fase 0) antes desta USP ir para produção.

- **D-006 (gate LGPD):** O fluxo de **re-aceite** de consentimento na reativação (ADR-0025) está validado com o DPO (texto e UX) antes de o ramo LGPD ir para produção.
