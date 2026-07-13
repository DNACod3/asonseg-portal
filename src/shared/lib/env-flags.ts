/**
 * Parser puro de flags booleanas de env — remediação USP-050 (PUB-1a, RL-MN-04).
 *
 * Substitui o preprocess frágil `v.toLowerCase() === 'true'` (que resolvia
 * `'1'`/`'yes'`/`'on'` e qualquer grafia não reconhecida em `false`
 * *silenciosamente*) por um parser que reconhece as grafias usuais e devolve o
 * valor **cru** para qualquer string não reconhecida — fazendo `z.boolean()`
 * reprovar e o boot falhar ruidoso (contrato de `env.ts`: "o build/boot falha
 * se uma variável estiver malformada").
 *
 * Edge-safe: função pura sem dependências externas.
 */

const TRUE_VALUES = new Set(['true', '1', 'yes', 'on']);
const FALSE_VALUES = new Set(['false', '0', 'no', 'off', '']);

/**
 * Normaliza uma env flag para `boolean`.
 *
 * - `boolean` de entrada → devolvido inalterado (passthrough).
 * - `string` reconhecida (case-insensitive, com `trim`) → `true`/`false`.
 * - `string` **não reconhecida** → devolvida **inalterada** (sentinela): não é
 *   `boolean`, então `z.boolean()` reprova o parse e `parseEnv` lança.
 * - Qualquer outro tipo (ex.: `undefined`, chave ausente) → devolvido
 *   inalterado, deixando o `.default()` do schema agir.
 */
export function parseBooleanFlag(raw: unknown): unknown {
  if (typeof raw !== 'string') return raw;

  const normalized = raw.trim().toLowerCase();
  if (TRUE_VALUES.has(normalized)) return true;
  if (FALSE_VALUES.has(normalized)) return false;

  // Sentinela: string não reconhecida devolvida crua para reprovar em z.boolean().
  return raw;
}
