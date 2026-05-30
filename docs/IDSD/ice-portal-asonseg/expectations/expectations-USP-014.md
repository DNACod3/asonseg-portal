# Expectations — USP-014: Remover responsável de uma Empresa

**Origem:** AC-014-1 a AC-014-3 do PRD v0.3, ajustados e estendidos.

## 1. Cenários de sucesso testáveis

- **E-001:** WHEN um responsável solicita remoção de um vínculo (próprio ou de outro responsável), the system SHALL marcar o vínculo como encerrado (data fim preenchida), preservar histórico do vínculo para auditoria, e enviar e-mail à Pessoa removida.

- **E-002:** IF a remoção deixaria a Empresa sem nenhum responsável ativo (incluindo o caso "remoção lateral via inativação de Pessoa em USP-007"), THEN the system SHALL bloquear a operação e exigir designação de outro responsável ativo antes.

  *Ajuste do AC-014-2:* explicita que o gate vale para qualquer rota que possa deixar a Empresa órfã (USP-014 direto + USP-007 via inativação).

- **E-003:** The system SHALL preservar vínculos encerrados no histórico (acesso via visão consolidada USP-039 ou auditoria), não filtrar implicitamente em consultas legítimas.

## 2. Proibições (must-not)

- **P-001 (toca F1 — Empresa órfã):** O sistema NÃO PODE permitir, por nenhuma rota (UI direta, USP-007 inativando Pessoa única responsável, chamada de API), que uma Empresa fique sem ao menos um responsável ativo. ADR-0014 é absoluto.

- **P-002 (toca F2 — sessão da Pessoa removida):** O sistema NÃO PODE permitir que Pessoa recém-removida do vínculo continue operando em nome dessa Empresa em sessão aberta (publicar vaga, ver candidatos, editar). A revogação de acesso ao escopo da Empresa precisa surtir efeito em janela curta — mesma janela acordada em USP-007/P-001 e USP-008/L-002.

- **P-003 (toca F3 — histórico oculto):** O sistema NÃO PODE ocultar vínculos encerrados das visões de auditoria e da visão consolidada (USP-039). Filtros "apenas ativos" são decisão consciente da consulta, não default implícito em todas as consultas.

- **P-004:** O sistema NÃO PODE permitir que Pessoa sem vínculo ativo de "responsável" da Empresa remova vínculos de terceiros dessa Empresa.

## 3. Limites

- **L-001 (Performance):** Submit ≤ 2s p95.
- **L-002 (Janela de revogação):** Pessoa removida deixa de operar em nome da Empresa em ≤ janela acordada (mesma decisão de USP-008/L-002).
- **L-003 (Retenção do histórico):** Vínculos encerrados retidos por toda a retenção institucional (ADR-0008).

## 4. Critérios de pronto, do ponto de vista do dono do intent

- **D-001:** Em ensaio: responsável remove outro responsável; Pessoa removida recebe e-mail; sua sessão aberta perde acesso ao painel da Empresa dentro da janela acordada.

- **D-002:** Em teste de Empresa órfã: tentativa de remover o único responsável ativo é bloqueada com mensagem clara. Mesmo teste replicado tentando inativar a Pessoa via USP-007 — mesmo bloqueio.

- **D-003:** A coordenadora abre o histórico de vínculos da Empresa e consegue ver os vínculos encerrados com data início, data fim, motivo (quando aplicável), Pessoa, responsável que efetuou a remoção.

- **D-004:** Em teste de bypass: tentativa de chamada direta à API removendo vínculo que deixaria a Empresa órfã é rejeitada com erro determinístico.
