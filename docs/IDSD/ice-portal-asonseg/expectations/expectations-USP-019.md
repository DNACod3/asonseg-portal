# Expectations — USP-019: Sugerir nova categoria de serviço ou área de vaga

**Origem:** AC-019-1 a AC-019-3 do PRD v0.3, ajustados e estendidos.

## 1. Cenários de sucesso testáveis

- **E-001:** WHEN o usuário escolhe "Outro / sugerir nova" no campo de categoria/área e digita um texto livre, the system SHALL **buscar similaridade no catálogo existente e sugerir alternativas** antes de aceitar a sugestão.

  *Ajuste do AC-019-1:* explicita prevenção de duplicatas via sugestão de similar (toca F1 do intent).

- **E-002:** WHEN o conteúdo é submetido para moderação contendo uma sugestão de categoria/área nova (não vinculada a categoria existente), the system SHALL enfileirar a sugestão na fila da diretoria (item 7 do catálogo USP-008) **e** permitir que o conteúdo siga moderação normal com a categoria provisória "Outro" + texto da sugestão.

  *Ajuste do AC-019-2:* explicita que conteúdo não fica bloqueado esperando aprovação de categoria (toca F3 do intent).

- **E-003:** WHEN a diretoria aprova uma sugestão, the system SHALL adicionar a categoria/área ao catálogo padronizado, recategorizar automaticamente os conteúdos que usavam essa sugestão como "Outro", e notificar autores afetados.

- **E-004:** WHEN a diretoria rejeita uma sugestão, the system SHALL manter os conteúdos que a usavam com a categoria provisória "Outro" e notificar autores (com sugestão de recategorizar manualmente).

## 2. Proibições (must-not)

- **P-001 (toca F1 — duplicatas):** O sistema NÃO PODE adicionar ao catálogo uma sugestão que tem similaridade textual alta com categoria existente sem alerta explícito ao aprovador. Catálogo limpo é responsabilidade do gate de aprovação.

- **P-002 (toca F2 — sugestão ofensiva/spam):** O sistema NÃO PODE permitir submit de sugestão com texto manifestamente sem sentido, ofensivo, ou abaixo de tamanho mínimo significativo.
  ✅ RESOLVIDO (dono do intent): filtro simples por lista de palavras + tamanho mínimo, ambos parâmetros tunáveis.

- **P-003 (toca F3 — conteúdo bloqueado):** O sistema NÃO PODE manter conteúdo (vaga ou serviço) bloqueado em "em moderação" **apenas** porque a sugestão de categoria está pendente. Conteúdo segue moderação com categoria provisória "Outro".

- **P-004:** O sistema NÃO PODE permitir aprovação de sugestão por usuário sem permissão item 7 do catálogo.

## 3. Limites

- **L-001 (Performance):** Busca de similaridade ≤ 2s p95.
- **L-002 (SLA aspiracional):** Decisão de diretoria sobre sugestão ≤ 7 dias da submissão.
- **L-003 (Tamanho do texto):** Sugestão entre N e M caracteres.
  ✅ RESOLVIDO (dono do intent): N e M são parâmetros tunáveis (sem valor estrutural fixo).

## 4. Critérios de pronto, do ponto de vista do dono do intent

- **D-001:** Uma Pessoa publicando vaga (USP-020) digita "Serv. de Limpeza" no campo "Outro"; sistema sugere "Limpeza" do catálogo; Pessoa aceita a sugestão; conteúdo é categorizado corretamente sem criar duplicata.

- **D-002:** A diretoria, em ensaio, abre a fila de sugestões pendentes e aprova/rejeita 3 em ≤ 10 min. Conteúdos que usavam a sugestão aprovada são recategorizados automaticamente.

- **D-003:** Em teste com sugestão de texto manifestamente inadequado (texto curto, sem sentido, ou ofensivo), submit é rejeitado com mensagem clara.

- **D-004 (Should — pode ir para v0.4):** Esta USP é prioridade Should no PRD; sponsor confirma se entra no MVP ou é diferida.
