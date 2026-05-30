# Intent — USP-025: Candidatar-se a uma vaga

**Origem:** PRD v0.3 §5.2, USP-025.
**Dono do intent:** Coordenador da área Portal Empregabilidade (intermediação institucional).

## 1. Descrição

Pessoa com papel candidato "ativo" (perfil moderado e aprovado — USP-009) clica em "candidatar-se" no detalhe de uma vaga ativa. Sistema persiste a candidatura, envia e-mail de confirmação ao candidato (USP-044) e revela os dados de contato do candidato para a Empresa-responsável (USP-027) — ação afirmativa do candidato dispara a revelação recíproca, princípio do ADR-0017. Outcome: candidato manifesta interesse explícito e abre canal de comunicação com a Empresa; Empresa tem material (CV, contato) para avaliar.

## 2. Restrições

- Pessoa precisa estar autenticada e ter papel candidato ativo (USP-009 aprovou perfil) (AC-025-3).
- Vaga precisa estar em status "ativo" (consistente com USP-022).
- Não permite candidatura duplicada não-cancelada (AC-025-2). Se quiser nova candidatura à mesma vaga, precisa cancelar (USP-026) e re-candidatar (AC-026-2).
- Candidatura persistida, e-mail de confirmação ao candidato, contato do candidato visível para Empresa (AC-025-1, ADR-0017).
- Consentimento "candidatura a vagas" (finalidade 2 do ADR-0013) precisa estar ativo para a Pessoa.

## 3. Cenários de fracasso (de resultado)

**F1. CV processado por IA (USP-040) com extração ruim chega à Empresa sem revisão efetiva e prejudica o candidato.**
Candidato anexa CV, IA extrai mal, candidato confirma sem revisar (AC-040-4 satisfeita formalmente mas vazia em substância — F1 de USP-040). Empresa recebe candidato com perfil "experiência: vazio" ou "área de interesse: irrelevante". Candidato perde oportunidade sem entender porquê. RP-008.

✅ RESOLVIDO (cobertura na origem): qualidade do CV tratada em USP-040/USP-009 + ADR-0027 (whitelist + revisão humana). Aqui é apenas o efeito a jusante — sem ação adicional necessária.

**F2. Empresa vê dados do candidato e usa para finalidade diferente da candidatura (lead comercial, marketing, recrutamento paralelo).**
ADR-0017 prevê revelação recíproca após ação afirmativa, mas não controla o que a Empresa faz com o dado depois. Empresa "minera" CVs de candidaturas e usa para fora do contexto. RP-003 indireto.

❓ Termo de responsabilidade da Empresa cobre explicitamente "uso restrito à finalidade de avaliação para a vaga"? (dono do intent — jurídico + coordenador) → D-002

**F3. Candidato candidata-se em massa (todas as vagas) e prejudica sinal-ruído para empresas.**
Sistema não limita N candidaturas por candidato. Pessoa com baixa literacia ou má-fé dá clique em todas → empresa recebe candidatura sem relação real de interesse → confiança no portal cai.

✅ RESOLVIDO (dono do intent): alerta operacional ao coordenador quando >20 candidaturas/semana de um mesmo candidato (tunável, ADR-0029); não bloqueia a candidatura. Impacto técnico: nenhum (observabilidade — TD §8.3).

**F4. Candidato cancelado (papel candidato desativado pela revogação do consentimento — USP-043, ADR-0013) ainda aparece em candidaturas históricas.**
Pessoa revoga consentimento da finalidade 2 (candidatura). Por ADR-0013/AC-043-4, papel candidato é desativado — não permite nova candidatura. Mas candidaturas históricas (pré-revogação) ficam visíveis para empresas?

✅ RESOLVIDO (dono do intent): candidaturas ativas são canceladas automaticamente (cascata da ADR-0025) sem notificação à Empresa — encerra silenciosamente; a Empresa percebe ao recarregar a lista. Impacto técnico: nenhum (matriz de cascata).

**F5. Atomicidade: persistir candidatura, enviar e-mail e revelar contato são 3 efeitos colaterais — falha parcial deixa estado inconsistente.**
Sistema persiste candidatura mas falha o e-mail; ou revela contato mas falha persistência. Estado fica meio-bom.

✅ RESOLVIDO (ADR-0020): candidatura + auditoria (`withAudit`) numa mesma transação Prisma; e-mail de confirmação e revelação de contato via `outbox` pós-commit com retry/idempotência (sem efeito órfão em rollback).

## 4. Cenários de sucesso

**Nível operacional:**
- Candidato ativo abre vaga, clica "candidatar-se" → candidatura persistida → e-mail de confirmação → Empresa vê o candidato na lista (USP-027) com badge "candidatura" + contato + link CV.
- Candidato pode cancelar (USP-026) se mudou de ideia; pode candidatar-se de novo posteriormente.

**Nível agregado:**
- **MP6** — total de candidaturas registradas. Métrica direta do funil.

## 5. Conexões

**USPs upstream:** USP-009 (perfil candidato aprovado), USP-021/USP-022 (descobriu vaga), USP-043 (consentimento finalidade 2).

**USPs downstream:** USP-026 (cancelar), USP-027 (Empresa vê), USP-044 (e-mail confirmação).

**ADRs aplicáveis:** ADR-0013 (consentimento), ADR-0017 (visibilidade recíproca após ação afirmativa).

**Métricas tocadas:** MP6 (candidaturas).

**Riscos relacionados:** RP-008 (CV processado por IA chega ruim à Empresa — encadeamento de USP-040). Risco proposto: mineração de dados de candidatos pela Empresa (mitigado parcialmente por termo). Risco proposto: candidatura em massa.

**Dependências:** D-002 (termo de responsabilidade da Empresa cobrindo uso restrito).

**Q-abertas:** —
