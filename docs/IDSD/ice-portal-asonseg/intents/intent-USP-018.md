# Intent — USP-018: Inativar conteúdo já publicado

**Origem:** PRD v0.3 §5.2, USP-018.
**Dono do intent:** Coordenador da área Portal.

## 1. Descrição

Coordenador (ou voluntário delegado) inativa vaga, CV ou serviço já ativo quando descobre problema posteriormente — informação enganosa, comportamento abusivo, sinalização externa. Outcome: status vira "arquivado" com motivo textual obrigatório; autor é notificado por e-mail (USP-044); auditoria registra a operação.

Esta USP é o **escape válve** do MVP — sem fluxo formal de denúncia, é via única para responder a problemas descobertos pós-publicação. Mitiga RP-010.

## 2. Restrições

- Motivo textual obrigatório (AC-018-1).
- Permissão delegável (item 5 do catálogo via USP-008).
- E-mail ao autor (USP-044).
- Auditoria imutável.
- Operação reversível? ✅ RESOLVIDO (dono do intent): sim — reversível sem prazo, pelo coordenador.

## 3. Cenários de fracasso (de resultado)

**F1. Inativação por engano sem caminho de reversão.**
Coordenador inativa vaga errada (URL parecida, conteúdo similar). Autor recebe e-mail, fica frustrado, sem caminho rápido de correção. RP-010 materializa-se ao contrário — atendimento a denúncia equivocada vira novo problema.

✅ RESOLVIDO (dono do intent): reversível sem prazo, pelo coordenador — pode voltar a "ativo" ou "rascunho" (transição na FSM do ADR-0024). Impacto técnico: nenhum.

**F2. Inativação demora — sinalização externa chegou mas coordenador não vê a tempo.**
Falta de canal claro de sinalização externa (e-mail institucional, alerta interno). Conteúdo problemático fica visível por dias.

✅ RESOLVIDO (dono do intent): canal = caixa institucional de e-mail monitorada + alerta ao coordenador (não há denúncia formal no MVP — RP-010). Impacto técnico: nenhum (operacional).

**F3. Inativação acidental afeta dados encadeados (vaga inativada após candidaturas — o que acontece com elas?).**
Vaga foi candidatada por Pessoa; coordenador inativa por descoberta de problema na Empresa. Candidaturas existentes ficam órfãs? Candidatos são notificados? E o badge "encaminhado pela ASONSEG" (USP-037) na candidatura?

✅ RESOLVIDO (dono do intent): candidaturas preservadas como histórico; a vaga é apenas ocultada da busca (on-read); sem e-mail aos candidatos. Impacto técnico: nenhum.

**F4. Motivo textual vazio ou genérico.**
Mesma patologia da USP-016/F3 — sem motivo claro, autor não entende.

## 4. Cenários de sucesso

**Nível operacional:**
- Coordenador inativa conteúdo em ≤ 2 min com motivo claro.
- Autor recebe e-mail explicativo.
- Conteúdo some da busca pública imediatamente.

**Nível agregado:**
- Sem métrica MP direta.
- ✅ RESOLVIDO (dono do intent): métrica instrumentada = nº de inativações pós-publicação/mês.

## 5. Conexões

**USPs upstream:**
- USP-008 (permissão), USP-016 (conteúdo previamente aprovado).

**USPs downstream:** —

**ADRs aplicáveis:** ADR-0015.

**Métricas tocadas:** —

**Riscos relacionados:** RP-010.

**Dependências:** —

**Q-abertas:** —
