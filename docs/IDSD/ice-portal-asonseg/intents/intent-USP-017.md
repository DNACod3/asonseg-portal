# Intent — USP-017: Validar Empresa na primeira vaga publicada

**Origem:** PRD v0.3 §5.2, USP-017.
**Dono do intent:** Coordenador da área Portal (executa a verificação) + diretoria (define padrão anti-fraude).

## 1. Descrição

Quando o coordenador (ou voluntário delegado) modera uma vaga cuja Empresa está marcada "não verificada" (primeira vaga, ou Empresa que voltou a esse status por edição de campos identitários — USP-015), o sistema destaca os dados da Empresa em destaque e exige verificação manual. Após aprovação da vaga, a Empresa é marcada "verificada" e essa transição é auditada (AC-017-2). Se há inconsistência, coordenador rejeita a vaga e a Empresa permanece "não verificada" (AC-017-3).

Esta USP é a **defesa principal contra RP-005 (empresa-fantasma)** no MVP, dado que consulta automática à Receita está out-of-scope (§3.2). Sem ela funcionar bem, o RP-005 materializa.

## 2. Restrições

- Disparada automaticamente quando vaga em moderação é de Empresa "não verificada".
- UI destaca dados da Empresa em paralelo aos dados da vaga.
- Decisão de aprovar a vaga = verificar a Empresa (AC-017-2).
- Rejeitar a vaga mantém Empresa "não verificada" (AC-017-3).
- Lista de verificação ("checklist") do coordenador é entregável de Fase 0 — **sem ela, esta USP não tem critério objetivo**.

## 3. Cenários de fracasso (de resultado)

**F1. Empresa-fantasma aprovada porque o coordenador não inspecionou de fato.**
Materialização principal de RP-005. UI pode destacar, mas se a checklist não foi feita ou o moderador apressou, Empresa fantasma vira "verificada". A partir daí, RP-005 está materializado.

❓ Checklist do coordenador (entregável de Fase 0) é validada pelo Bravi PO + sponsor antes do go-live. **Bloqueante de produção.** (dono do intent — coordenador + Bravi PO)

**F2. Verificação é confundida com a moderação da vaga — coordenador aprova a vaga inspecionando só conteúdo da vaga, esquecendo dos dados da Empresa.**
UI da USP-016 destaca, mas se o destaque é sutil, o moderador acostumado com fila aprova como sempre. Diferente de F1, aqui não é negligência consciente — é fricção de UX.

✅ RESOLVIDO (dono do intent): uma decisão única — uma tela com checklist da Empresa + aprovação da vaga, confirmadas juntas (atômico, ADR-0024). Impacto técnico: nenhum.

**F3. Empresa rejeitada (vaga rejeitada) mas a Empresa não é "marcada como suspeita" — Pessoa-responsável publica nova vaga e tenta de novo.**
AC-017-3 mantém "não verificada" mas não marca a Empresa como "suspeita" ou "rejeitada". Pessoa-responsável tenta de novo com vaga ligeiramente diferente. Moderador da próxima rodada não tem como saber que essa Empresa já foi rejeitada antes.

✅ RESOLVIDO (dono do intent): histórico de rejeições visível ao moderador, sem aprovação dupla — o moderador decide sozinho. Impacto técnico: nenhum (content_transitions já registra o histórico).

**F4. Verificação automática "preguiçosa" — se Pessoa-responsável editou Empresa entre o rascunho e a moderação, a checagem usa dados antigos.**
Race entre USP-015 (edição) e USP-016/017 (moderação). Snapshot dos dados precisa ser do momento da moderação, não do rascunho.

## 4. Cenários de sucesso

**Nível operacional:**
- Coordenador acessa fila, abre vaga, vê dados da Empresa em destaque com indicação "primeira vaga — verificar".
- Coordenador executa checklist (em ≤ 10 min): consulta CNPJ na Receita externamente, valida endereço, contato, coerência com a vaga.
- Aprova → Empresa "verificada", vaga "ativa", auditoria registra.
- Empresa verificada aparece nos painéis (USP-027, USP-028) e na home (USP-041).

**Nível agregado:**
- MP2 (Empresas verificadas).
- ✅ RESOLVIDO (dono do intent): métrica instrumentada = nº de Empresas rejeitadas na verificação inicial / nº de tentativas.

## 5. Conexões

**USPs upstream:**
- USP-012 (Empresa "não verificada"), USP-015 (Empresa volta a "não verificada"), USP-020 (vaga em moderação), USP-016 (fluxo geral).

**USPs downstream:**
- USP-021, USP-022 (vaga aprovada visível, com nome da Empresa para autenticado).
- USP-027, USP-028, USP-041 (Empresa verificada).

**ADRs aplicáveis:**
- ADR-0014 (Empresa sem login N:N — flag "verificada" é atributo da Empresa)
- ADR-0015 (moderação humana — verificação é a peça anti-fraude)

**Métricas tocadas:** MP2.

**Riscos relacionados:** RP-005 (defesa principal).

**Dependências:** Q proposta — checklist de verificação como entregável de Fase 0.

**Q-abertas:** —
