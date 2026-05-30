# Expectations — USP-024: Expiração automática de vaga

**Origem:** AC-024-1 a AC-024-3 do PRD v0.3, ajustados e estendidos.

## 1. Cenários de sucesso testáveis

- **E-001:** WHEN a data de validade da vaga é atingida (timezone América/São_Paulo), the system SHALL alterar o status da vaga para "expirado" automaticamente — via job batch ou via verificação on-read, com persistência do status atualizada quando o job rodar.

- **E-002:** The system SHALL ocultar vagas expiradas da busca pública (USP-021) e do detalhe (USP-022 exibe mensagem clara), independentemente do status persistido ainda estar como "ativo" por janela de job atrasado — **verificação on-read garante consistência**.

  *Ajuste do AC-024-2:* explicita defesa contra F1 do intent (job falha silenciosamente).

- **E-003:** WHEN faltam 3 dias para a expiração, the system SHALL enviar e-mail à Empresa-responsável (USP-044) avisando e oferecendo prorrogação (USP-023/E-004).

- **E-004:** The system SHALL exibir, no painel interno do responsável (USP-027 ou painel da Empresa), badge visual de "expira em N dias" para vagas próximas da validade — não depender apenas do e-mail.

  *Ajuste:* AC do PRD cobre apenas e-mail; vem do F3 do intent (e-mail pode ir para spam).

## 2. Proibições (must-not)

- **P-001 (toca F1 — job falha em silêncio):** O sistema NÃO PODE deixar vaga expirada visível na busca pública mesmo que o job de expiração tenha falhado. Verificação on-read (consulta filtra por validade ≥ hoje) garante consistência. Falha do job dispara alerta operacional (RNF 6.6).

- **P-002 (toca F2 — timezone errado):** O sistema NÃO PODE expirar vaga em horário diferente do esperado pelo timezone América/São_Paulo. Cálculo de "data de validade atingida" é determinístico no timezone local.

- **P-003 (toca F3 — Empresa perde janela sem perceber):** O sistema NÃO PODE depender exclusivamente do canal e-mail para informar proximidade de expiração. Sinal visual dentro do portal é parte obrigatória da notificação.

- **P-004 (toca F4 — vaga expirada permite ação):** O sistema NÃO PODE aceitar candidatura (USP-025) a vaga expirada por nenhuma rota — nem por URL salva, nem por chamada direta à API.

- **P-005:** O sistema NÃO PODE excluir fisicamente a vaga expirada. Histórico fica preservado conforme ADR-0008 (candidaturas, decisões, MP6).

## 3. Limites

- **L-001 (Janela de expiração):** Vaga deve transicionar para "expirado" em ≤ 1 hora da data de validade no timezone local (se for via job periódico).
- **L-002 (E-mail D-3):** E-mail "expira em 3 dias" entregue ao SMTP em ≤ 24 h antes do início do dia D-3.
- **L-003 (Observabilidade):** Falha do job de expiração SHALL disparar alerta para o coordenador + Bravi (RNF 6.6).

## 4. Critérios de pronto, do ponto de vista do dono do intent

- **D-001:** Em ensaio: vaga com data de validade ajustada para hoje 23:59 (América/São_Paulo); à 00:00 do dia seguinte, vaga sai da busca pública e do detalhe; ao 1:00, status persistido = "expirado". Validado por inspeção do painel.

- **D-002:** Em teste de job falho: simular falha do job de expiração; verificar que **vaga vencida ainda assim não aparece na busca** (verificação on-read funcionou). Validado por engenheiro Bravi.

- **D-003:** Em ensaio: Pessoa-responsável de vaga próxima da expiração recebe e-mail 3 dias antes E vê badge "expira em 3 dias" no painel interno.

- **D-004:** Em teste de candidatura tardia: candidato tenta candidatar-se via URL salva a vaga já expirada; sistema bloqueia com mensagem clara e CTA para outras vagas.

- **D-005:** O coordenador inspeciona dashboard de saúde da operação e confere indicador de "vagas expiradas hoje" e "última execução do job de expiração". Validado pelo sponsor.
