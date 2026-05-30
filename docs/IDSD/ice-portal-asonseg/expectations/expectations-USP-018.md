# Expectations — USP-018: Inativar conteúdo já publicado

**Origem:** AC-018-1 e AC-018-2 do PRD v0.3, ajustados e estendidos.

## 1. Cenários de sucesso testáveis

- **E-001:** WHEN o coordenador (ou voluntário com permissão item 5 do catálogo via USP-008) inativa conteúdo já ativo (vaga, CV ou serviço), the system SHALL exigir motivo textual obrigatório com conteúdo mínimo significativo, alterar status para "arquivado", enviar e-mail ao autor com o motivo e registrar log com decisor, data/hora, motivo.

- **E-002:** WHEN o conteúdo é inativado, the system SHALL removê-lo imediatamente das listagens públicas (busca de vagas USP-021, busca de candidatos USP-028, busca de serviços USP-030, home USP-041) e dos painéis de empresa/prestador (USP-027, USP-035).

- **E-003:** WHEN uma vaga é inativada e havia candidaturas ativas, the system SHALL preservar as candidaturas no histórico e notificar candidatos com aviso explicativo claro.
  ✅ RESOLVIDO (dono do intent): candidaturas preservadas como histórico (sem notificação ativa); badge "encaminhado pela ASONSEG" preservado no histórico; a vaga é apenas ocultada.

  *Ajuste:* AC do PRD não cobre candidaturas órfãs; vem do F3 do intent.

- **E-004:** The system SHALL permitir reversão da inativação (voltar para "ativo" ou "rascunho") por usuário com mesma permissão ou superior, com motivo textual, em janela limitada.
  ✅ RESOLVIDO (dono do intent): reversível sem prazo (janela indefinida), pelo coordenador.

## 2. Proibições (must-not)

- **P-001 (toca F1 — sem reversão):** O sistema NÃO PODE deixar inativação sem caminho de reversão claro. Inativação por engano precisa ser corrigível sem chamar a Bravi.

- **P-002 (toca F2 — sinalização externa lenta):** O sistema NÃO PODE depender exclusivamente do coordenador "ver de vez em quando" o e-mail institucional. Canal de sinalização externa precisa estar definido e operacional.
  ✅ RESOLVIDO (dono do intent): caixa institucional de e-mail monitorada + alerta ao coordenador.

- **P-003 (toca F3 — candidaturas órfãs invisíveis):** O sistema NÃO PODE deixar candidatos de vaga recém-inativada sem notificação. Cada candidato afetado recebe e-mail explicativo.

- **P-004 (toca F4 — motivo vazio):** O sistema NÃO PODE aceitar motivo textual vazio, com caractere único, espaços ou texto manifestamente genérico. Mesma regra de USP-016/P-003.

- **P-005:** O sistema NÃO PODE permitir inativação por usuário sem permissão item 5 do catálogo (ou superior — coordenador, diretoria).

- **P-006:** O sistema NÃO PODE apagar fisicamente o conteúdo inativado — status "arquivado" preserva todo o histórico para auditoria (ADR-0008).

## 3. Limites

- **L-001 (Performance):** Submit da inativação ≤ 2s p95. Remoção das listagens públicas com efeito imediato (≤ 30s).
- **L-002 (E-mail):** Autor notificado em ≤ 60s. Candidatos afetados (quando vaga) notificados em ≤ 5 min.
- **L-003 (Auditoria):** Log imutável, retido conforme ADR-0008.

## 4. Critérios de pronto, do ponto de vista do dono do intent

- **D-001 (gate operacional):** Antes desta USP ir para produção, o canal de sinalização externa está definido (caixa institucional monitorada, formulário público, ou equivalente). Sem canal, USP-018 não responde ao seu propósito (mitigar RP-010).

- **D-002:** A coordenadora, em ensaio, inativa uma vaga ativa em ≤ 2 min com motivo claro. Autor recebe e-mail com motivo. Vaga some da busca pública em ≤ 30 s.

- **D-003:** Em ensaio com vaga que tinha candidaturas: candidatos recebem e-mail explicativo dentro da janela acordada. Histórico das candidaturas permanece visível para a AS.

- **D-004:** Em teste de reversão: coordenadora inativa vaga por engano, percebe, reverte dentro da janela acordada. Vaga volta a aparecer. Auditoria registra os dois eventos (inativação + reversão).

- **D-005:** A diretoria abre o relatório de inativações pós-publicação por mês e usa o número como sinal de qualidade da moderação inicial (USP-016/017). Validação por inspeção do relatório (USP-042).
