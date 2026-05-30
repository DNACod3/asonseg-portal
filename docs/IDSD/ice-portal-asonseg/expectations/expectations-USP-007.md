# Expectations — USP-007: Inativar Pessoa (desligamento de voluntário ou pedido do titular)

**Origem:** AC-007-1 a AC-007-3 do PRD v0.3, ajustados e estendidos.

## 1. Cenários de sucesso testáveis

- **E-001:** WHEN um usuário autorizado (coordenador para voluntários, diretoria para qualquer Pessoa, DPO para pedido do titular) inativa uma Pessoa, the system SHALL impedir novos logins dessa Pessoa e registrar log com responsável, motivo e data/hora.

- **E-002:** WHILE a Pessoa está inativa, the system SHALL preservar todo o histórico operacional (candidaturas, encaminhamentos, vagas publicadas, serviços, ficha social, consentimentos LGPD) — visível para usuários com permissão apropriada na visão consolidada (USP-039).

- **E-003:** WHEN a Pessoa inativada é único responsável de pelo menos uma Empresa, the system SHALL bloquear a inativação até que seja designado outro responsável ativo para todas as Empresas afetadas (USP-014 + ADR-0014).

  *Ajuste do AC-007-3:* explicita que o bloqueio precede a inativação (não corrige depois).

- **E-004:** WHEN a inativação é a pedido do titular (LGPD), the system SHALL exibir comunicação clara ao titular informando que **o acesso é desativado e os consentimentos suspensos, mas o histórico permanece preservado por finalidade institucional** (ADR-0008 + ADR-0013).

  *Ajuste:* AC do PRD não exige texto explícito; vem do F4 do intent — gap LGPD a fechar.

## 2. Proibições (must-not)

- **P-001 (toca F1 — sessão ativa pós-inativação):** O sistema NÃO PODE permitir que Pessoa recém-inativada execute operações autenticadas em sessão já aberta. A verificação de status precisa rejeitar a próxima requisição em janela curta.
  ✅ RESOLVIDO (ADR-0030): revalidação de status por request, com cache opcional ≤30s — inativação efetiva em janela curta (mesma decisão de USP-004/P-004).

- **P-002 (toca F2 — Empresa órfã):** O sistema NÃO PODE permitir inativação de Pessoa por nenhuma rota (UI, API direta, função administrativa) sem antes garantir que ela não seja único responsável ativo de Empresa. Sem garantia, a operação é bloqueada — ADR-0014 não admite exceção.

- **P-003 (toca F3 — histórico desaparece):** O sistema NÃO PODE ocultar histórico de Pessoa inativada das visões legítimas (USP-039, ficha social, relatórios). O filtro de "apenas ativos" é decisão consciente da visão, não filtro implícito.

- **P-004 (toca F4 — comunicação LGPD inadequada):** O sistema NÃO PODE concluir inativação a pedido do titular sem ter exibido (e registrado a ciência do) texto explicativo que distingua "desativação de acesso" de "eliminação de dados". Sem essa distinção comunicada, ASONSEG fica vulnerável a reclamação na ANPD.

- **P-005:** O sistema NÃO PODE apagar consentimentos LGPD da Pessoa inativada — eles ficam registrados como **suspensos com data/hora**, parte do histórico (ADR-0013 + ADR-0008).

- **P-006:** O sistema NÃO PODE permitir reativação de Pessoa inativada por usuário sem permissão equivalente (ou superior) à de quem fez a inativação original.
  ✅ RESOLVIDO: coberta pela USP-045 (ADR-0030); refletir no PRD v0.4.

## 3. Limites

- **L-001 (Performance):** Submit da inativação ≤ 2s p95.
- **L-002 (Janela de invalidação de sessão):** Após inativação, sessão ativa rejeitada em janela curta — alvo ≤ 30 segundos (idealmente cada requisição).
  ✅ RESOLVIDO (ADR-0030): revalidação por request com cache opcional ≤30s (mesma decisão de USP-004); idealmente a cada requisição.
- **L-003 (Retenção):** Histórico preservado por toda a retenção institucional (ADR-0008).
- **L-004 (Auditoria):** Log de inativação imutável, inclui responsável, motivo e data/hora.

## 4. Critérios de pronto, do ponto de vista do dono do intent

- **D-001:** A coordenadora inativa um voluntário em ensaio em ≤ 30 segundos do clique inicial. Voluntário não consegue logar na tentativa seguinte. Histórico do voluntário continua visível na visão consolidada.

- **D-002:** Em teste de sucessão: ao tentar inativar Pessoa única responsável de uma Empresa, o sistema bloqueia com mensagem clara apontando qual(is) Empresa(s) precisam de novo responsável. Após designação, a inativação prossegue.

- **D-003 (gate jurídico):** Antes desta USP ir para produção, o **D-001 do PRD (DPO)** está designado e o texto da comunicação LGPD (caso pedido do titular) está revisado pelo jurídico. Sem isso, o ramo "pedido do titular" desta USP **não vai para produção**.

- **D-004:** Em teste de sessão ativa: Pessoa em sessão aberta é inativada em outro browser; sua próxima requisição é negada dentro da janela acordada. Validado por engenheiro Bravi + sponsor.

- **D-005:** A AS abre uma Pessoa inativada em USP-039 e confere que histórico, ficha social, candidaturas e encaminhamentos permanecem visíveis para ela.

- **D-006:** Em teste de erro: coordenador inativa Pessoa por engano e **consegue reverter** via fluxo claro (reativação) sem ajuda de Bravi.
  ✅ RESOLVIDO: reativação decidida (USP-045 — zera grants, ADR-0030), desbloqueia. O conteúdo final do catálogo permanece gate D-006 (Fase 0).
