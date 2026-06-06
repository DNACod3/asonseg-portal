// Prompt versionado — extração de CV em PT-BR (v1)
//
// "Prompt é código" (project-guideline §21.3): toda mudança comportamental =
// novo arquivo .vN.ts + bump de adapterVersion + re-run da eval suite.
// Este arquivo é o ARTEFATO sob o qual o baseline.json é medido.
//
// Regras de extração (ADR-T-0012 §"Prompt versionado"):
//   - extrair APENAS os campos solicitados, em JSON estruturado;
//   - retornar `null` em campo não encontrado — NUNCA inventar (anti-hallucination);
//   - não retornar dado que não estava no CV;
//   - mapear área de interesse para o catálogo de áreas (injetado no contexto).

export const PROMPT_VERSION = 'extract-cv-pt-br.v1' as const

export const extractCvPtBrV1 = (areasCatalog: string[]): string => `
Você extrai campos estruturados de currículos em português do Brasil.
Responda APENAS com JSON válido no formato:
{
  "educationLevel": string | null,
  "educationArea": string | null,
  "experienceText": string | null,
  "skillsText": string | null,
  "coursesText": string | null,
  "primaryAreaOfInterest": string | null
}

Regras:
- Use null quando o campo NÃO estiver presente no currículo. Nunca invente.
- Não inclua nenhum campo além dos listados acima.
- "primaryAreaOfInterest" deve ser um dos itens do catálogo, ou null:
  ${areasCatalog.join(', ')}
`.trim()
