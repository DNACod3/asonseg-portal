# Expectations — USP-042: Relatórios operacionais do Portal

**Origem:** AC-042-1 e AC-042-2 do PRD v0.3, ajustados e estendidos.

## 1. Cenários de sucesso testáveis

- **E-001:** WHEN o usuário autorizado (coordenador no escopo da própria área; diretoria no escopo geral; AS para relatórios sociais) acessa um relatório, the system SHALL exibir lista filtrável por período, status e categoria — respeitando visibilidade por papel.

- **E-002:** The system SHALL permitir exportação em CSV (≤ 10s p95 para janela mensal) e PDF (≤ 20s p95), com **cabeçalho/watermark** "Dados pessoais — uso restrito conforme LGPD" em qualquer exportação que contenha PII.

  *Ajuste do AC-042-2:* explicita watermark (toca F1 do intent — vazamento por canal não-criptografado).

- **E-003:** The system SHALL registrar log imutável de cada export (quem exportou, qual relatório, quais filtros, data/hora, escopo de PII incluído).

- **E-004:** The system SHALL exibir, em todo relatório de encaminhamentos (MP9), a taxa de "sem resultado registrado" **lado a lado** com a taxa de sucesso — defesa contra viés de registro do USP-038/F1.

  *Ajuste:* AC do PRD não cobre dupla exibição; vem do F4 do intent.

- **E-005:** WHEN a janela do relatório ultrapassa um limite (ex.: > 1 ano), the system SHALL usar pré-agregação ou paginar — sem travar a UI.
  ✅ RESOLVIDO (project-guideline §14.2 + decisão PO 2026-05-29): pré-agregação para janela longa; **sem recusa de janela no MVP** (volume baixo) — limite como parâmetro tunável.

## 2. Proibições (must-not)

- **P-001 (toca F1 — CSV compartilhado em canal aberto):** O sistema NÃO PODE gerar exportação com PII **sem** watermark/cabeçalho explícito "Dados pessoais — uso restrito conforme LGPD". Sem isso, o canal de compartilhamento posterior fica sem sinal mínimo de cuidado.

- **P-002 (toca F2 — sem DPO):** O sistema NÃO PODE permitir relatórios com PII em produção sem DPO designado. Sem DPO, apenas relatórios agregados sem PII ficam liberados.

- **P-003 (toca F3 — estrutura mínima vira improviso):** O sistema NÃO PODE ir para produção sem que os 3-5 relatórios prioritários (validados pela diretoria + coordenador) tenham filtros mínimos funcionando. Caso contrário coordenador faz pivot em CSV cru por fora.
  ❓ Lista de 3-5 relatórios prioritários a fechar com diretoria. (dono do intent — D-005 / QP-005)

- **P-004 (toca F4 — MP9 inflada):** O sistema NÃO PODE exibir taxa de sucesso de encaminhamento (MP9) sem exibir simultaneamente a taxa de "sem resultado registrado". Decisão estratégica baseada em métrica enviesada é falha de resultado.

- **P-005 (toca F5 — janela longa trava):** O sistema NÃO PODE deixar exportação anual rodar síncrona sem paginação ou pré-agregação — fricção operacional inaceitável.

- **P-006 (toca F6 — fila de moderação expõe rascunho):** O sistema NÃO PODE permitir acesso ao relatório de fila de moderação por usuário sem permissão "moderar vaga/CV/serviço" (itens 1, 2 ou 3 do catálogo USP-008) ou superior. Conteúdo em rascunho não vaza para voluntário sem permissão.

- **P-007:** O sistema NÃO PODE incluir ficha social (USP-036) em relatórios disponíveis ao coordenador. Apenas AS e diretoria têm relatórios com dado sensível social.

- **P-008:** O sistema NÃO PODE exportar PII sem que o usuário tenha aceitado, no momento do export, ciência da responsabilidade (checkbox "compreendo que sou responsável pelo uso destes dados conforme LGPD").

## 3. Limites

- **L-001 (Performance):** CSV mensal ≤ 10s p95; PDF ≤ 20s p95 (RNF 6.1).
- **L-002 (Auditoria):** Cada export registrado em log imutável (ADR-0008).
- **L-003 (Visibilidade por papel):** Coordenador escopo da própria área; diretoria geral; AS para relatórios sociais.
- **L-004 (Retenção):** Dados históricos para relatórios conforme ADR-0008 (retenção indefinida com base institucional).

## 4. Critérios de pronto, do ponto de vista do dono do intent

- **D-001 (gate compliance LGPD — BLOQUEANTE):** Antes desta USP ir para produção com relatórios contendo PII, **D-001 do PRD (DPO designado)** está confirmado por escrito. Sem DPO, **apenas relatórios agregados sem PII** ficam liberados — relatórios com PII ficam atrás do gate.

- **D-002 (gate operacional):** Antes desta USP entregar valor pleno, **D-005 / QP-005 (lista dos 3-5 relatórios prioritários + filtros mínimos)** está fechada com diretoria + coordenador. Sem isso, coordenador improvisa em planilhas paralelas.

- **D-003:** A coordenadora, em ensaio, roda relatório mensal de vagas e exporta CSV em ≤ 10s. Arquivo tem cabeçalho "Dados pessoais — uso restrito conforme LGPD".

- **D-004:** A diretoria, em ensaio, roda relatório trimestral de encaminhamentos e vê MP9 com **taxa de "sem resultado registrado"** lado a lado.

- **D-005:** Em teste de permissão: voluntário sem permissão "moderar" tenta acessar relatório de fila de moderação por URL direta; sistema bloqueia com 403 + log da tentativa.

- **D-006:** Em teste de export: coordenador tenta exportar CSV com PII; sistema exige checkbox de ciência antes de gerar; log registra o aceite.

- **D-007:** A AS roda relatório de Pessoas com ficha social cadastrada por região; coordenador rodando o mesmo relatório recebe versão **sem** os dados sensíveis sociais.

- **D-008:** Em teste de performance: exportação de janela anual usa pré-agregação ou paginação; não trava a UI.
