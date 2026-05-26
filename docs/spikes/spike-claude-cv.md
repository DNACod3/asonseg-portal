# Spike — Claude: extração de CV (custo/latência/qualidade)

- **Issue:** #108 · **US:** #105 · **Épico:** #4 (Fase 0)
- **Data:** 2026-05-26
- **Camada:** infra (spike) · **Decisão de base:** ADR-0012 (LLM) · orienta o módulo `cv-extraction`
- **Status:** Prototipado — execução com chave real **pendente** (modo híbrido, ver §"Execução")

## Objetivo

Validar a extração de campos estruturados de currículos via Claude — **custo, latência e
qualidade** — para embasar o módulo `cv-extraction`. A interface de consumo deve mirar a **porta
`CVExtractor`** (consumidores nunca dependem do `@anthropic-ai/sdk` direto — CLAUDE.md / `shared/container.ts`).

## Modo de execução (híbrido)

Em dev local o `ANTHROPIC_API_KEY` é dummy (`sk-ant-dummy-key`), então **não foram feitas chamadas
reais**. Este spike entrega: (1) o **protótipo pronto para rodar**, (2) o **schema Zod** da saída,
(3) a **estratégia de prompt/validação** e (4) **estimativas de custo/latência** com premissas
explícitas. Basta exportar uma `ANTHROPIC_API_KEY` real e rodar o protótipo (§"Como reproduzir")
para preencher a coluna "medido" da tabela de qualidade.

## Abordagem recomendada

1. **Saída estruturada nativa** (`messages.parse` + `output_config: { format: json_schema }`) — o
   modelo é forçado a devolver JSON aderente ao schema. Alternativa equivalente: _tool use_ com
   `tool_choice: { type: 'tool', name: 'extract_cv' }`. Preferir `output_config` (mais simples,
   sem _round-trip_ de tool result).
2. **Entrada do documento:**
   - **PDF** → bloco `document` (`source.type: 'base64'`, `media_type: 'application/pdf'`). Claude
     lê texto **e** layout (bom para CVs com colunas/tabelas).
   - **DOCX** → não há suporte nativo; converter para texto (ex.: `mammoth`) e enviar como `text`,
     ou converter para PDF. **Decisão:** no MVP, extrair texto do DOCX e enviar como `text`.
   - **TXT/colado** → enviar como `text`.
3. **Validação na fronteira:** o `parsed_output` ainda é validado com **Zod** no adapter (o
   `json_schema` reduz, mas não elimina, divergências). Saída inválida ⇒ erro tratado (sem `throw`
   no Server Action; `{ ok: false }`).

## Schema da saída (Zod) — esboço para `cv-extraction`

```ts
import { z } from 'zod';

export const cvExtractionSchema = z.object({
  nomeCompleto: z.string().nullable(),
  email: z.string().email().nullable(),
  telefone: z.string().nullable(),
  cidade: z.string().nullable(),
  resumoProfissional: z.string().nullable(),
  experiencias: z.array(z.object({
    cargo: z.string(),
    empresa: z.string().nullable(),
    inicio: z.string().nullable(),      // ISO "YYYY-MM" quando inferível
    fim: z.string().nullable(),         // null = atual
    descricao: z.string().nullable(),
  })).default([]),
  formacao: z.array(z.object({
    curso: z.string(),
    instituicao: z.string().nullable(),
    conclusao: z.string().nullable(),
  })).default([]),
  habilidades: z.array(z.string()).default([]),
  idiomas: z.array(z.object({ idioma: z.string(), nivel: z.string().nullable() })).default([]),
}).strict();

export type CvExtraction = z.infer<typeof cvExtractionSchema>;
```

`null` em vez de string vazia para campos ausentes — distingue "não consta no CV" de "vazio".

## Porta `CVExtractor` (DI via `shared/container.ts`)

```ts
// modules/cv-extraction/ports/cv-extractor.ts
export interface CVExtractor {
  extract(input:
    | { kind: 'pdf'; data: Buffer }
    | { kind: 'text'; text: string }
  ): Promise<{ ok: true; data: CvExtraction; usage: { inputTokens: number; outputTokens: number } }
           | { ok: false; error: string }>;
}
```

O adapter `ClaudeCVExtractor` implementa a porta; nenhum consumidor importa o SDK. Trocar o modelo
ou o provedor = trocar o _binding_ no container, sem tocar nos consumidores.

## Protótipo (pronto para rodar — descartável, não vai pro `main`)

```ts
// prototipo-cv.mjs  — requer: npm i @anthropic-ai/sdk zod-to-json-schema ; ANTHROPIC_API_KEY real
import Anthropic from '@anthropic-ai/sdk';
import { readFileSync } from 'node:fs';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { cvExtractionSchema } from './schema.mjs';

const client = new Anthropic();
const MODEL = process.env.ANTHROPIC_MODEL ?? 'claude-haiku-4-5';
const schema = zodToJsonSchema(cvExtractionSchema, { target: 'openApi3' });

const pdf = readFileSync(process.argv[2]).toString('base64');
const t0 = Date.now();
const msg = await client.messages.parse({
  model: MODEL,
  max_tokens: 2048,
  system: 'Extraia os campos do currículo. Use null quando o campo não constar. Não invente dados.',
  messages: [{ role: 'user', content: [
    { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: pdf } },
    { type: 'text', text: 'Extraia os dados estruturados deste currículo.' },
  ]}],
  output_config: { format: { type: 'json_schema', schema } },
});
const parsed = cvExtractionSchema.parse(msg.parsed_output); // valida com Zod na fronteira
console.log(JSON.stringify(parsed, null, 2));
console.log({ ms: Date.now() - t0, usage: msg.usage });
```

> Mantido como bloco de código (não como arquivo solto), conforme o escopo de "protótipo descartável".

## Estimativas de custo / latência

> **Premissa de preço** (confirmar na página de pricing da Anthropic antes de fechar orçamento):
> Haiku 4.5 ≈ **US$ 1 / MTok** entrada e **US$ 5 / MTok** saída; Sonnet 4.x ≈ **US$ 3 / MTok**
> entrada e **US$ 15 / MTok** saída. CV típico (1–2 páginas) ≈ **~3.000 tokens** de entrada (PDF
> com layout) e **~800 tokens** de saída estruturada.

| Modelo | Custo/CV (estimado) | 500 CVs/mês | 2.000 CVs/mês | Latência esperada |
|---|---|---|---|---|
| **Haiku 4.5** | ~US$ 0,007 | ~US$ 3,50 | ~US$ 14 | ~2–5 s |
| Sonnet 4.x | ~US$ 0,021 | ~US$ 10,50 | ~US$ 42 | ~4–8 s |

`count_tokens` (`/v1/messages/count_tokens`) permite medir o input exato **antes** de enviar, para
orçamento/limites. Cache de prompt no `system` reduz custo se o prompt crescer.

## Recomendação / Decisão

- **Modelo:** **Haiku 4.5** como default do `cv-extraction` — extração de campos é tarefa de baixa
  complexidade e o custo/latência é ~3× melhor que Sonnet. Manter `ANTHROPIC_MODEL` no env (já existe)
  para promover a Sonnet caso a qualidade medida em CVs reais fique abaixo do aceitável.
- **Saída:** `output_config` json_schema **+** validação Zod no adapter (defesa em profundidade).
- **Entrada:** PDF como `document`; DOCX → texto; TXT direto. Limitar tamanho do arquivo (ex.: ≤ 5 MB)
  antes de enviar.
- **Robustez:** `null` para campos ausentes; instrução explícita "não inventar"; timeout + retry
  (1x) no adapter; em falha, `{ ok: false, error }` (sem `throw`).
- **Privacidade/LGPD:** extração é operação vinculada a finalidade de consentimento — exigir
  `requireActiveConsent` antes de extrair, e auditar via `withAudit` no Server Action que a dispara.

## Como reproduzir (quando houver chave real)

```bash
export ANTHROPIC_API_KEY=sk-ant-...        # chave real (custo por chamada!)
npm i @anthropic-ai/sdk zod-to-json-schema
node prototipo-cv.mjs caminho/para/cv.pdf  # imprime JSON extraído + usage + latência
```

Rodar em uma amostra de 10–20 CVs reais/sintéticos (variando formato e qualidade) e preencher a
taxa de acerto por campo para fechar a recomendação de modelo.

## Referências

- Anthropic SDK TS — _structured outputs_ (`messages.parse`, `output_config`/`json_schema`),
  `tool_choice`, `count_tokens`, blocos `document` (PDF base64).
- ADR-0012 — abstração de LLM (porta `CVExtractor`).
- CLAUDE.md — _LLM Abstraction_; padrão de Server Action (consentimento + auditoria).
