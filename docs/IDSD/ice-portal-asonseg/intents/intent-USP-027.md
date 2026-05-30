# Intent — USP-027: Empresa ver lista de candidatos da vaga

**Origem:** PRD v0.3 §5.2, USP-027.
**Dono do intent:** Coordenador da área Portal Empregabilidade (curador da relação Empresa↔candidatos).

## 1. Descrição

Pessoa-responsável de uma Empresa abre uma de suas vagas e vê a lista de pessoas que se candidataram, com dados de contato e link para CV. Candidaturas que vieram via encaminhamento institucional da ASONSEG (USP-037) trazem badge visível "Candidato encaminhado pela ASONSEG" — diferencial do ADR-0016. Outcome: Empresa tem material para avaliar e contactar; badge sinaliza curadoria institucional; data/hora de candidatura ordena ou contextualiza.

## 2. Restrições

- Acesso só para Pessoa-responsável ativa da Empresa dona da vaga (ADR-0014).
- Lista mostra candidaturas ativas (canceladas escondidas — consequência de AC-026-1).
- Cada item: nome do candidato + contato (e-mail e telefone) + link para CV (AC-027-1).
- Encaminhadas: badge visível "Candidato encaminhado pela ASONSEG" (AC-027-2).
- Data/hora exibida (AC-027-3).
- Sem gerenciamento de status (vista/entrevistada/contratada) — fica para V2 (out-of-scope explícito).
- Dados revelados aqui são consequência da ação afirmativa do candidato (USP-025) — coerente com ADR-0017.

## 3. Cenários de fracasso (de resultado)

**F1. Sem status na lista, Empresa perde controle de quem já entrevistou — mistura, esquece, ou re-contata.**
Lista é apenas "todos os candidatos ativos"; sem flag "vista", "em análise", "rejeitada". Para 30+ candidaturas, Empresa precisa anotar fora do sistema. Diferencial perdido em relação a portais concorrentes.

✅ ACEITO (dono do intent): status de candidatura fica para V2 (decisão do PRD). No MVP, o badge "encaminhada via ASONSEG" + feedback de resultado via USP-038 (registrado pelo encaminhador) fecham o ciclo para a Empresa.

**F2. CV processado por IA com qualidade ruim (RP-008) chega à Empresa, prejudica imagem da ASONSEG como curadora.**
Cf. F1 do USP-025. Empresa abre lista, encontra candidatos com "experiência: [campo vazio]" porque IA extraiu mal e candidato confirmou sem revisar. Empresa atribui ao portal, não ao processo IA.

✅ RESOLVIDO (dono do intent): sim — a lista exibe indicador "CV preenchido com extração automática" (transparência). Impacto técnico: nenhum (UI).

**F3. Badge "ASONSEG" cria expectativa elevada e qualidade real do encaminhamento decepciona — risco reputacional.**
Pessoa encaminhada pode ter perfil divergente da vaga (encaminhador usou bom senso, mas Empresa esperava match curado). Badge institucional faz Empresa esperar candidato superior, decepção é grande.

❓ Treinamento textual / guideline ao encaminhador para evitar encaminhamentos de baixo match (mencionado no ADR-0016). Aplicado fora do sistema. (dono do intent — coordenador)

**F4. Empresa-responsável deixa de ser ativa (USP-014 — remoção de vínculo) e candidatos ainda pendentes "perdem o canal" — ninguém da Empresa olha a lista.**
Pessoa responsável foi removida (saiu da empresa, troca de RH). Empresa precisa ter ≥1 responsável ativo (ADR-0014, AC-014-2) — então outra Pessoa pode acessar; mas se houver gap operacional, candidatos ficam sem resposta.

✅ ACEITO (dono do intent): AC-014-2 cobre a estrutura; risco operacional remanescente (lista sem ninguém olhando) é gestão interna da Empresa, fora do sistema.

## 4. Cenários de sucesso

**Nível operacional:**
- Empresa-responsável abre vaga → vê N candidaturas com nome, contato, CV link.
- Candidaturas encaminhadas têm badge ASONSEG → Empresa percebe o diferencial.
- Empresa contata candidato diretamente por canal próprio (telefone/e-mail) → fora do sistema.

**Nível agregado:**
- MP6 (candidaturas) confluem para esta tela — funil convergindo.
- Visibilidade da badge sustenta proposta de valor do ADR-0016 (encaminhamento institucional).

## 5. Conexões

**USPs upstream:** USP-025 (candidatura), USP-037 (encaminhamento → candidatura com badge).

**USPs downstream:** — (Empresa age fora do sistema).

**ADRs aplicáveis:** ADR-0014 (acesso por Pessoa-responsável), ADR-0016 (badge encaminhamento), ADR-0017 (revelação após ação afirmativa).

**Métricas tocadas:** MP6 (indireto).

**Riscos relacionados:** RP-008 (CV processado por IA chega ruim). Risco proposto: badge cria expectativa que encaminhamento real não cumpre.

**Dependências:** —

**Q-abertas:** —
