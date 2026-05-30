# ADR-0027 — Porta CVExtractor, provedor LLM com ZDR e whitelist de campos

- **Status:** Accepted
- **Data:** 2026-05-28
- **Decisores:** Arquiteto Bravi, Tech Lead, DPO (diretora Angélica — D-001 resolvido)
- **Tags:** integração, IA, LGPD, custo

## Contexto e Problema

O ADR-0018 (negócio) define extração de CV via IA generativa, best-effort, com validação humana obrigatória e **Zero Data Retention (ZDR) obrigatório**, deixando a escolha do provedor ao Arquiteto (D-008/QP-002). Os intents marcam `(arquitetural-estrutural)`: USP-040/F6 "prompt restringe a campos pré-definidos? Validação no retorno descarta extras?". Os must-not:

- USP-009/P-002 e USP-040/P-002: "NÃO PODE enviar CV a provedor de IA sem ZDR contratualmente garantido e configurado. Sem ZDR, a extração não acontece — preenchimento manual."
- USP-040/P-003: termo da finalidade 7 menciona o **nome do provedor**; trocar provedor → re-aceite (liga a ADR-0025/versionamento).
- USP-040/P-005: instrumentar nº de extrações/mês, custo/extração; limite por candidato/dia.
- USP-040/P-006: prompt restritivo + **whitelist** no retorno descarta campos não-mapeados (CPF, RG, foto, estado civil, religião) — minimização LGPD.

## Drivers de Decisão

- ZDR como critério de conformidade inegociável (RP-008).
- Provedor trocável sem reescrever o consumidor (custo + lock-in — ADR-0010).
- Best-effort: falha do LLM nunca bloqueia o cadastro (ADR-0018).
- Minimização: nada além do escopo entra no perfil.

## Opções Consideradas

### Opção A — Porta `CVExtractor` (interface) + adapter Anthropic Claude Haiku (ZDR) + prompt restritivo + whitelist no retorno
- **Descrição:** O consumidor (`cv-extraction`) depende só da interface `CVExtractor`, resolvida via `shared/container.ts`. O adapter padrão usa Claude Haiku com ZDR habilitado; o prompt restringe a extração aos campos do catálogo; o **retorno passa por um validador Zod com whitelist** que descarta qualquer campo fora do escopo. Operação **assíncrona** (job ≤30s p95) com feedback; falha → formulário vazio (best-effort). Telemetria de custo/uso + rate limit por candidato/dia (ADR-0029). Uma **feature flag** desliga a extração se o ZDR não estiver configurado.
- **Prós:** ZDR garantido; provedor trocável (porta); minimização por whitelist; degradação graciosa.
- **Contras:** Custo por extração (baixo com Haiku) e dependência externa — mitigados por flag e fallback manual.
- **Custo estimado:** ~US$ 1–5/mês no volume do MVP.

### Opção B — SDK do provedor direto no consumidor
- **Contras:** Lock-in; trocar provedor reescreve código; viola a abstração pedida pelo ADR-0018. Rejeitada.

### Opção C — Parser estruturado puro (sem LLM)
- **Contras:** Qualidade baixa em CVs livres; é o **fallback** quando não há ZDR, não a solução primária.

## Decisão

Adotamos a **Opção A**. Consumidor depende da **porta `CVExtractor`**; adapter padrão **Claude Haiku com ZDR**; **prompt restritivo + whitelist Zod** no retorno (minimização); operação **assíncrona best-effort**; **feature flag** liga a extração somente com ZDR configurado, senão cai para preenchimento manual. O **arquivo original do CV** é armazenado em storage privado com URL assinada (ADR-0028). Troca de provedor é mudança "major" do termo da finalidade 7 → re-aceite (ADR-0025).

## Consequências

**Positivas:**
- ZDR garantido por configuração + flag; minimização por whitelist (USP-040/P-006).
- Provedor trocável sem tocar o consumidor; custo baixo e instrumentado.

**Negativas (trade-offs aceitos):**
- USP-040/USP-009 **não vão a produção** sem ZDR confirmado + termo finalidade 7 (D-001 resolvido; resta gate D-002/D-008).
- Latência de extração (assíncrona) — UX preenche enquanto roda.

**Neutras / a monitorar:**
- Custo/uso da API monitorado; limite por candidato/dia ajustável.

## Referências

- ADR-0018 (negócio), ADR-0025 (versionamento de termo), ADR-0028 (storage/PII), ADR-0029 (rate limit), `runbook-llm-adapter` (se extraído) / `runbook-consent-gate`.
- USPs servidas: USP-009, USP-040.
