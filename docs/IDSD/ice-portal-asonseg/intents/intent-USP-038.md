# Intent — USP-038: Registrar resultado do encaminhamento manualmente

**Origem:** PRD v0.3 §5.2, USP-038.
**Dono do intent:** Assistente social (responsável principal pelo acompanhamento de resultados sociais). Coordenador/diretoria também.

## 1. Descrição

Assistente social ou usuário autorizado registra manualmente o resultado de um encaminhamento (contratado, não selecionado, em análise, sem resposta) quando descobre por canal externo. Outcome: encaminhamento (entidade do ADR-0016) deixa de ser apenas "criado" e passa a ter desfecho conhecido; ASONSEG mede o impacto institucional do Portal (MP9 — % de encaminhamentos contratados).

## 2. Restrições

- Registro de resultado é opcional e a qualquer momento (ADR-0016).
- Persistência inclui: resultado (enum: contratado, não selecionado, em análise, sem resposta), observação textual, data (AC-038-1).
- Operação restrita a quem tem permissão (AS, coordenador, diretoria — ou voluntário com permissão delegada se ADR-0001 estendido incluir).
- Decisão consciente: sem coleta automatizada via Empresa (ADR-0016, Bloco 7) — todo resultado é declarativo manual.

## 3. Cenários de fracasso (de resultado)

**F1. Viés de registro: apenas resultados positivos são lançados; MP9 fica inflada.**
Registrado na matriz como risco proposto. Encaminhador motiva-se a registrar "contratado" (boa notícia). "Não selecionado" e "sem resposta" são esquecidos. MP9 mostra 80% de sucesso quando real é 30%. Diretoria toma decisão com base em métrica enviesada.

✅ RESOLVIDO (dono do intent): lembrete por e-mail ao encaminhador 30 dias após o encaminhamento (tunável); métrica % de encaminhamentos sem resultado é responsabilidade do coordenador. Impacto técnico: mínimo (job leve + outbox + métrica).

**F2. Fonte do resultado é só "ouvido por canal externo" — sem verificação, qualquer pessoa pode registrar qualquer coisa.**
AS escuta da Pessoa "fui contratada" e registra. Pessoa pode ter mentido ou confundido. Empresa nunca confirmou. Resultado fica como verdade no sistema.

✅ RESOLVIDO (dono do intent): sim — campo enum 'fonte' (Pessoa | Empresa | terceiro) obrigatório, além da observação textual.

**F3. Resultado registrado contradiz o estado real meses depois (Pessoa foi contratada e depois demitida).**
Resultado é evento pontual; situação evolui. Sistema não modela ciclo de vida pós-contratação.

✅ ACEITO (dono do intent): acompanhamento pós-contratação fora do MVP — sem ação.

**F4. Múltiplas atualizações de resultado da mesma USP-037 — sem versionamento.**
"Em análise" → "contratada" → "demitida em 30 dias". Sistema sobrescreve ou guarda histórico?

✅ RESOLVIDO (ADR-0023 / TD §4.5): cada atualização é uma nova linha em `referral_results` (append-only versionado, USP-038/P-003).

## 4. Cenários de sucesso

**Nível operacional:**
- AS encontra a Pessoa em atendimento posterior, descobre que ela foi contratada → abre o encaminhamento → registra "contratado" + observação ("contratada após entrevista em 15/06; empresa pagou 80% da remuneração proposta").
- Encaminhamento aparece em USP-039 (visão consolidada) com desfecho.

**Nível agregado:**
- **MP9** — % de encaminhamentos com resultado "contratado" sobre total de encaminhamentos. Materializa impacto institucional.

## 5. Conexões

**USPs upstream:** USP-037 (encaminhamento existe), USP-008 (permissão de registrar resultado, se delegada a voluntário).

**USPs downstream:** USP-039 (visão consolidada inclui resultado).

**ADRs aplicáveis:** ADR-0016 (encaminhamento como entidade — resultado é atributo).

**Métricas tocadas:** MP9 (% encaminhamentos contratados).

**Riscos relacionados:** Risco proposto: viés de registro (só positivos lançados). Risco proposto: resultado declarativo sem verificação.

**Dependências:** —

**Q-abertas:** —
