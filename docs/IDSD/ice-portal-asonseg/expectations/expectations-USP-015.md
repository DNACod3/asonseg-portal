# Expectations — USP-015: Editar dados da Empresa

**Origem:** AC-015-1 e AC-015-2 do PRD v0.3, ajustados e estendidos.

## 1. Cenários de sucesso testáveis

- **E-001:** WHEN o responsável submete a edição de dados não-identitários (descrição, endereço, contato), the system SHALL persistir as alterações imediatamente e registrar log de auditoria com campos antes/depois, responsável e data/hora.

- **E-002:** IF a edição alterar CNPJ, razão social ou nome fantasia, THEN the system SHALL **rebaixar a flag "verificada" para falso** e exibir aviso explícito ao responsável de que a próxima vaga publicada exigirá nova verificação manual (USP-017).

  *Ajuste do AC-015-2:* explicita o aviso visual ao responsável **antes** da confirmação da edição (proteção a F2 do intent — mudança consciente).

- **E-003:** WHEN a Empresa é rebaixada para "não verificada", the system SHALL marcar internamente os campos alterados desde a última verificação, para que a tela do moderador na próxima vaga (USP-017) destaque o que mudou.

## 2. Proibições (must-not)

- **P-001 (toca F1 — rebaixamento esquecido):** O sistema NÃO PODE persistir edição de CNPJ, razão social ou nome fantasia sem rebaixar a flag "verificada" para falso na mesma transação. Não há rota administrativa de edição que pule esse rebaixamento.

- **P-002 (toca F2 — re-verificação invisível ao moderador):** O sistema NÃO PODE apresentar, na fila de moderação (USP-016) ou na verificação de Empresa (USP-017), uma vaga de Empresa rebaixada **sem destacar visualmente** que a Empresa foi editada após verificação original e quais campos identitários mudaram.

- **P-003 (toca F3 — descrição abusada):** O sistema NÃO PODE permitir que edição apenas da descrição da Empresa (não rebaixa "verificada") fique invisível à moderação se houver vaga ativa em paralelo.
  ✅ RESOLVIDO (dono do intent): editar campos identitários (CNPJ/razão/fantasia) rebaixa e re-verifica a Empresa na próxima vaga; editar descrição/contato só re-modera o conteúdo editado, sem rebaixar (ADR-0024).

- **P-004:** O sistema NÃO PODE permitir edição de dados da Empresa por Pessoa sem vínculo ativo de "responsável" dessa Empresa.

- **P-005:** O sistema NÃO PODE permitir alteração do CNPJ para um valor que já pertence a outra Empresa no portal (unique constraint preserved no update).

## 3. Limites

- **L-001 (Performance):** Submit ≤ 2s p95.
- **L-002 (Auditoria):** Histórico completo das edições retido por toda a retenção institucional (ADR-0008). Campos antes/depois preservados.

## 4. Critérios de pronto, do ponto de vista do dono do intent

- **D-001:** Em ensaio: responsável edita razão social da Empresa; sistema mostra aviso explícito "essa alteração exigirá nova verificação na próxima vaga"; após confirmar, Empresa é rebaixada para "não verificada"; busca pública não mostra mais a Empresa até nova verificação.

- **D-002:** O moderador (USP-017) abre a próxima vaga dessa Empresa e vê banner destacando "Empresa editada após verificação original — campos alterados: CNPJ, razão social". Validado por inspeção do sponsor.

- **D-003:** Em teste de bypass: tentativa de chamada direta à API editando CNPJ sem rebaixar "verificada" é rejeitada com erro determinístico.

- **D-004:** A coordenadora abre o histórico de edições de uma Empresa e vê quem editou o quê e quando.
