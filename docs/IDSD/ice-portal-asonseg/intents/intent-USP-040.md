# Intent — USP-040: Extração automática de CV via IA generativa

**Origem:** PRD v0.3 §5.2, USP-040.
**Dono do intent:** Coordenador da área Portal Empregabilidade (responsável pela UX do candidato e pela qualidade do que vai à Empresa). Decisão técnica delegada ao Arquiteto/Tech Lead (ADR-0018).

## 1. Descrição

Candidato anexa CV em PDF/DOC/DOCX no perfil. Sistema invoca provedor LLM externo para extrair campos estruturados (escolaridade, área de formação, experiência, habilidades, cursos). Sistema pré-preenche o formulário, candidato revisa e confirma explicitamente cada campo antes de salvar. Outcome: candidato com CV pronto economiza tempo no cadastro; campos extraídos servem para busca ativa da Empresa (USP-028) e para apresentação na candidatura (USP-027); validação humana obrigatória protege exatidão LGPD (ADR-0018).

## 2. Restrições

- Trigger: upload de CV (PDF, DOC, DOCX até 5MB) (AC-040-1).
- Sistema envia ao provedor LLM externo (RNF 6.1: ≤ 30s p95, assíncrono aceitável com feedback).
- Provedor LLM com **Zero Data Retention (ZDR)** preferencial (ADR-0018) — decisão técnica delegada (QP-002, D-008).
- Pré-preenchimento + indicação visual clara de "extraído automaticamente — revise" (AC-040-2).
- **Validação humana obrigatória:** candidato confirma cada campo explicitamente antes de salvar (AC-040-4, ADR-0018 — protege LGPD).
- Falha de extração = degradação graciosa: formulário vazio para preenchimento manual, sem erro disruptivo (AC-040-3).
- Arquivo original do CV permanece armazenado vinculado ao candidato (AC-040-5).
- Consentimento "extração de CV via IA generativa" (finalidade 7 do ADR-0013) precisa estar ativo. Termo precisa mencionar o nome do provedor e cobrir Zero Data Retention (ADR-0018) — D-002.

## 3. Cenários de fracasso (de resultado)

**F1. Candidato confirma sem revisar; dados ruins entram no sistema.**
RP-007 explícito. AC-040-4 satisfeita formalmente (botão "confirmar" clicado) mas vazia em substância — candidato com baixo letramento ou pressa não inspeciona. Empresa recebe perfil pobre/errado.

✅ RESOLVIDO (dono do intent / cf. USP-009): bloco com scroll-to-confirm + destaque visual nos campos preenchidos pela IA (igual à USP-009); revisão obrigatória. Impacto técnico: nenhum (UI). (dono do intent — designer + coordenador)

**F2. Provedor LLM escolhido não tem ZDR efetiva — CV de candidato fica retido para treinamento do modelo.**
RP-008 explícito. Arquiteto escolhe provedor sob pressão de custo (ADR-0010) ou disponibilidade, sem ZDR formal. Dado pessoal sai da ASONSEG para terceiro sem garantia de retenção.

✅ RESOLVIDO (ADR-0027): feature flag liga a extração via IA **somente com ZDR configurado**; sem ZDR, a USP-040 fica desabilitada e o candidato cai para preenchimento manual (fallback best-effort). ❓ GATE DE PRODUÇÃO (compliance/negócio — preservado): termo da finalidade 7 nomeando o provedor específico, aprovado pelo jurídico (D-002), antes do go-live.

**F3. Termo de consentimento da finalidade 7 não menciona o provedor LLM específico — transparência ao titular incompleta.**
ADR-0018 exige termo que mencione o nome do provedor e política de retenção. Sem isso, consentimento é genérico e formal — LGPD frágil.

✅ RESOLVIDO parte técnica (ADR-0027 / ADR-0025): mudança de provedor é classificada como mudança "major" do termo da finalidade 7 → exige re-aceite de todos os candidatos (via versionamento do termo, ADR-0025). ❓ Redação específica do termo (com nome do provedor) permanece com jurídico (D-002). (dono do intent — jurídico + DPO + Arquiteto) → D-002

**F4. Extração falha mas degradação graciosa não chega ao usuário — candidato fica confuso vendo formulário vazio sem explicação.**
AC-040-3 diz "sem mensagem de erro disruptiva". Mas "sem mensagem nenhuma" também é ruim — candidato anexou CV, esperava preenchimento, vê vazio. Pode achar que a feature está quebrada.

✅ RESOLVIDO (dono do intent / ADR-0027): sim — quando há falha da extração, exibe mensagem não-disruptiva "não conseguimos preencher automaticamente — preencha manualmente abaixo" (fallback best-effort). Impacto técnico: nenhum (UI). (dono do intent — designer)

**F5. Custo da API LLM por candidato cresce mais que esperado (ADR-0010 estressado).**
Volume de uploads excede previsão; cada extração custa $X; mês 6 vê fatura inesperada. Sustentabilidade financeira da feature comprometida.

✅ RESOLVIDO (ADR-0027 / TD §8.2 / ADR-0029): telemetria de nº de extrações/mês e custo/extração instrumentada; limite por candidato/dia parametrizável (tunável). D-008 (confirmação contratual do ZDR) permanece como gate operacional. (dono do intent — coordenador + Arquiteto) → D-008

**F6. Candidato anexa CV com dados sensíveis adicionais (CPF, RG, foto, estado civil) e LLM extrai e armazena no estruturado.**
CV pode conter dados não pedidos (foto 3x4, estado civil, religião — comum em CVs brasileiros). LLM pode tentar mapear esses campos extra para o formulário. Sistema acaba persistindo dados que nunca pediu, contrariando minimização LGPD.

✅ RESOLVIDO (ADR-0027): prompt restritivo aos campos do catálogo + validador Zod com whitelist no retorno que **descarta campos não-mapeados** (CPF/RG/foto/estado civil/religião) — minimização LGPD.

**F7. Latência alta (≥30s) frustra candidato; ele fecha aba e a candidatura nunca acontece.**
RNF 6.1 marca ≤30s p95 — limite alto. Cauda longa (p99 > 60s) pode ser comum em LLM. Candidato sai antes de concluir.

✅ RESOLVIDO (ADR-0027): operação assíncrona best-effort (≤30s p95) — candidato pode preencher manualmente enquanto a extração roda; ao concluir, sistema oferece "queremos sugerir preenchimento?". Impacto técnico: nenhum estrutural. (dono do intent — designer + Arquiteto)

## 4. Cenários de sucesso

**Nível operacional:**
- Candidato anexa CV → barra de progresso/feedback visual aparece → extração retorna em <30s → formulário pré-preenchido com flag visual "extraído — revise" em cada campo → candidato revisa, ajusta o que está errado, confirma cada campo, salva.
- Em caso de falha, formulário fica vazio com mensagem amigável; candidato preenche manualmente.

**Nível agregado:**
- **MP1** (indireto) — acelera ativação de candidato; redução de fricção no cadastro aumenta taxa de conversão visitante → candidato ativo.
- Diferencial UX vs portais que exigem digitação completa.

## 5. Conexões

**USPs upstream:** USP-009 (candidato anexa CV), USP-043 (consentimento finalidade 7).

**USPs downstream:** USP-009 (pré-preenche formulário), USP-025 (CV processado aparece na candidatura), USP-027 (Empresa vê dados eventualmente extraídos), USP-028 (busca ativa usa dados extraídos).

**ADRs aplicáveis:** ADR-0010 (custo da API LLM — diretriz de custo mínimo restringe a escolha do provedor), ADR-0013 (consentimento finalidade 7), ADR-0018 (IA generativa com validação humana obrigatória).

**Métricas tocadas:** MP1 (indireto — ativação de candidato).

**Riscos relacionados:** RP-007 (candidato valida sem revisar), RP-008 (provedor sem ZDR), RP-003 (termo finalidade 7 cobrindo IA — encadeamento). Risco proposto: LLM extrai campos sensíveis não-mapeados (minimização LGPD).

**Dependências:** D-002 (termo finalidade 7), D-008 (escolha do provedor LLM), QP-002 (provedor + política ZDR).

**Q-abertas:** QP-002 (qual provedor; ZDR; custo previsto; latência aceitável).
