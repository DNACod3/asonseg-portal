# Expectations — USP-016: Moderar rascunho (vaga, CV ou serviço)

**Origem:** AC-016-1 a AC-016-5 do PRD v0.3, ajustados e estendidos.

## 1. Cenários de sucesso testáveis

- **E-001:** WHEN o coordenador (ou voluntário com permissão delegada — itens 1, 2 ou 3 do catálogo USP-008) acessa a fila de moderação, the system SHALL listar rascunhos com status "em moderação" ordenados por data de envio (mais antigo primeiro), com indicador visual claro de tipo (vaga / CV / serviço) e de Empresa "não verificada" quando aplicável.

- **E-002:** WHEN o moderador aprova um item, the system SHALL alterar status para "ativo", enviar e-mail ao autor (USP-044) e gravar log com decisor, data/hora, motivo (opcional para aprovar).

- **E-003:** WHEN o moderador devolve para ajustes, the system SHALL exigir motivo textual com **conteúdo mínimo significativo**, alterar status para "aguardando ajustes", enviar e-mail ao autor com o motivo e gravar log.

  *Ajuste do AC-016-3:* explicita conteúdo mínimo do motivo (toca F3 do intent).

- **E-004:** WHEN o moderador rejeita definitivamente, the system SHALL exigir motivo textual com conteúdo mínimo, alterar status para "rejeitado", enviar e-mail ao autor com o motivo e gravar log.

- **E-005:** WHEN a fila atinge um limiar de envelhecimento ou volume, the system SHALL gerar alerta operacional ao coordenador (e à diretoria como backup).
  ✅ RESOLVIDO (dono do intent): alerta ao coordenador quando >10 itens pendentes OU item há >48h em fila (tunável).

## 2. Proibições (must-not)

- **P-001 (toca F1 — fila inviabilizada):** O sistema NÃO PODE deixar fila acumular silenciosamente. Quando o limiar acordado é ultrapassado, alerta é gerado — sem alerta, o coordenador opera no escuro e RP-004 materializa.

- **P-002 (toca F2 — Empresa-fantasma escapa):** O sistema NÃO PODE permitir aprovação de vaga cuja Empresa esteja "não verificada" sem que a tela do moderador tenha exibido o painel da USP-017 (dados da Empresa em destaque + indicação clara "primeira vaga — verificar Empresa"). UI sutil que torne a verificação invisível é falha.

- **P-003 (toca F3 — motivo vazio):** O sistema NÃO PODE aceitar motivo textual vazio, com caractere único, espaços ou texto manifestamente genérico ("x", "—", "ok", "ajustar") em "devolver" ou "rejeitar".
  ✅ RESOLVIDO (dono do intent): ≥ 20 caracteres em texto livre + lista opcional de motivos comuns.

- **P-004 (toca F4 — sem reversão rápida):** O sistema NÃO PODE deixar de exibir, ao lado de cada item já moderado, atalho direto para USP-018 (inativar conteúdo publicado). Resposta a problemas pós-publicação precisa ser de poucos cliques.

- **P-005 (toca F5 — conflito de interesse):** O sistema NÃO PODE permitir que o autor do conteúdo (Pessoa-responsável da Empresa que publicou a vaga, candidato do próprio CV, ou prestador do próprio serviço) seja o moderador desse item. Mesmo que o autor tenha a permissão delegada, o item não aparece na fila dele.

- **P-006 (toca F6 — auditoria parcial):** O sistema NÃO PODE permitir operação de moderação via API direta que não passe pelo registro de auditoria padrão (decisor, motivo, data/hora). Operação em massa precisa registrar cada decisão individualmente.

- **P-007:** O sistema NÃO PODE permitir moderação por usuário sem permissão correspondente (item 1, 2 ou 3 do catálogo + permissão ativa — USP-008).

## 3. Limites

- **L-001 (Performance):** Listagem da fila ≤ 2s p95. Submit da decisão ≤ 2s p95.
- **L-002 (SLA aspiracional):** Tempo médio entre envio e decisão ≤ 72h (MP10, meta aspiracional para v0.4).
- **L-003 (Auditoria):** Log imutável retido por toda a retenção institucional (ADR-0008). Inclui decisor, item, decisão, motivo, data/hora.
- **L-004 (E-mail):** E-mail ao autor entregue ao SMTP em ≤ 60s da decisão.

## 4. Critérios de pronto, do ponto de vista do dono do intent

- **D-001 (gate operacional):** Antes desta USP ir para produção, **D-006 do PRD (catálogo final de permissões)** está fechado, **e a checklist de verificação de Empresa** (entregável de Fase 0 para USP-017) está validada. Sem o catálogo e a checklist, USP-016+017 ficam subjetivas demais para sustentar RP-005.

- **D-002:** A coordenadora, em ensaio, processa 5 itens da fila com decisões variadas (aprovar, devolver, rejeitar) em ≤ 25 minutos no total. Cada autor recebe e-mail correto com motivo legível.

- **D-003:** Em teste de fila envelhecida: sistema gera alerta operacional quando limiar é atingido. Validado por inspeção da caixa do coordenador.

- **D-004:** Em teste de conflito de interesse: voluntário-moderador-prestador tenta abrir seu próprio serviço em moderação; sistema bloqueia.

- **D-005:** Em teste de motivo vazio: tentativa de devolver com texto "x" ou em branco é rejeitada com mensagem clara exigindo conteúdo mínimo.

- **D-006:** A coordenadora acessa, ao lado de uma vaga ativa, atalho direto para inativá-la (USP-018) com no máximo 2 cliques.
