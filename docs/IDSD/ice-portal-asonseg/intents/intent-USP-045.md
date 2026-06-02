# Intent — USP-045: Reativação de Pessoa inativada (fluxo inverso da USP-007)

**Origem:** nascida da USP-007/F5 e formalizada por ADR-0030 (a refletir no PRD v0.4). Fluxo inverso da inativação.
**Dono do intent:** Coordenador da área (reativar voluntário) + diretoria (qualquer Pessoa) + DPO (quando reverte inativação feita a pedido do titular sob LGPD).

## 1. Descrição

Um usuário autorizado reverte a inativação de uma Pessoa, devolvendo-lhe o acesso. Outcome: a Pessoa volta a conseguir logar, seu histórico operacional continua íntegro (nunca foi apagado — ADR-0008), **mas suas permissões/vínculos delegados NÃO são restaurados automaticamente** — a reativação "zera grants" (decisão registrada em USP-007/D-006 + ADR-0030). A conta volta válida, porém "limpa": os papéis/delegações que a Pessoa tinha antes precisam ser reconcedidos explicitamente (USP-008).

Esta USP existe para dar um **caminho de reversão claro ao erro de inativação** (USP-007/F5) sem reabrir brechas de privilégio. Quem pode reativar é, no mínimo, alguém com permissão igual ou superior à de quem fez a inativação original (USP-007/P-006) — não se reabre por baixo o que foi fechado por cima.

## 2. Restrições

- **R1 (USP-007/P-006):** reativação só por ator com permissão **igual ou superior** à de quem inativou.
- **R2 (USP-007/D-006 + ADR-0030):** reativação **zera grants** — não restaura papéis/delegações automaticamente; conta volta sem privilégios.
- **R3 (ADR-0008):** histórico nunca foi apagado; reativação reabilita acesso, não "recria" dado.
- **R4 (ADR-0030):** o efeito da reativação propaga por revalidação de status por request (≤30s) — o login volta a ser aceito na janela curta, sem precisar de ação manual sobre a sessão.
- **R5 (ADR-0025 + ADR-0013 + ADR-0008):** consentimentos LGPD ficaram **suspensos** (não apagados) na inativação; a reativação de acesso **não reinstaura** consentimentos — exige **re-aceite** pelo titular (ADR-0025 — re-aceite de consentimento). ❓ (DPO) validar o texto/fluxo do re-aceite.
- **R6 (auditoria imutável):** registra quem reativou, motivo e data/hora.
- **R7 (catálogo de motivos):** motivo de reativação a partir de catálogo controlado. ❓ (dono do intent) conteúdo do catálogo é gate de Fase 0 (mesma natureza do USP-007/D-006).

## 3. Cenários de fracasso (de resultado)

> O que NÃO PODE acontecer no mundo, mesmo que todos os ACs de input passem.

**F1. Reativação restaura automaticamente papéis/delegações antigos.**
A Pessoa volta com os privilégios que tinha antes, sem reconcessão criteriosa. Brecha de privilégio — contradiz a decisão "zera grants" (R2). É o fracasso central desta USP.

**F2. Pessoa reativada continua sem conseguir logar após a janela de revalidação.**
A reversão não teve efeito; falha justamente quando mais se precisa dela (corrigir uma inativação por engano).

**F3. Reativação feita por ator com permissão inferior à de quem inativou.**
Ex.: coordenador reativa Pessoa que a diretoria havia inativado por motivo grave. Burla a hierarquia (vetor de R1/P-006).

**F4. Reativação reinstaura consentimentos LGPD que o titular havia perdido/suspenso.**
Dado volta a ser tratado por finalidade sem base válida (vetor de R5). ASONSEG vulnerável na ANPD.

**F5. Reativação por engano ou má-fé sem rastro auditável de quem e por quê.**
Sem log imutável, não há como apurar.

**F6. Reativação "ressuscita" uma Pessoa cuja inativação deveria ser definitiva.**
Ex.: Pessoa pública que pediu desligamento definitivo. ❓ (dono do intent) existem inativações irreversíveis?

## 4. Cenários de sucesso

**Nível operacional (uma sessão):**
- O coordenador que inativou um voluntário por engano o reativa sozinho em ≤ 30 segundos; na tentativa seguinte o voluntário consegue logar; o histórico está intacto; mas o voluntário aparece **sem** os papéis antigos, que o coordenador reconcede conscientemente.

**Nível agregado (métrica):**
- Sem métrica MP direta (espelha USP-007). ❓ (dono do intent) avaliar "% de inativações revertidas" como sinal de erro operacional.

## 5. Conexões

**USPs upstream:**
- USP-007 (inativação) — pré-condição: só se reativa quem está inativo.

**USPs downstream:**
- USP-004 (login volta a ser aceito)
- USP-008 (reconcessão de permissões delegadas — **não** automática)
- USP-014 (se a Pessoa voltar a assumir responsabilidade de Empresa)

**ADRs aplicáveis:**
- ADR-0030 (revalidação de status/permissão por request — efeito da reativação)
- ADR-0008 (histórico preservado)
- ADR-0011 (Pessoa fundamental — operação opera sobre a entidade)
- ADR-0025 (re-aceite de consentimento na reativação — não auto-reinstaura)
- ADR-0013 (consentimento por finalidade)
- ADR-0023 (auditoria do log de reativação)

**Métricas tocadas:** —

**Riscos relacionados:** privilégio restaurado indevidamente (F1); reversão ineficaz (F2).

**Dependências:** catálogo de motivos (gate Fase 0, espelha USP-007/D-006); DPO designado (ramo LGPD).

**Q-abertas:**
- ✅ DECIDIDO (ADR-0025): reativação **não** auto-reinstaura consentimentos suspensos — exige re-aceite. ❓ (DPO) resta validar o texto/fluxo do re-aceite (alimenta F4/P-003)
- ❓ (dono do intent) existem inativações irreversíveis? (alimenta F6/P-006)
- ❓ (dono do intent) catálogo de motivos de reativação.
