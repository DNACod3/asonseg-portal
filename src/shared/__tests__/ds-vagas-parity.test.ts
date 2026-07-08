import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * U20-MN-04 / U21-MN-04 / U22-MN-05 — guarda de paridade DS (Fase 2 / AD-014/AD-015).
 *
 * Restyle style-only de Vagas (USP-020 Publicar / USP-021 Buscar pública / USP-022
 * Detalhe): trava que os arquivos tocados adotaram os primitivos/tokens da fundação
 * (`@/shared/ui`) em vez de utilitário de paleta fixa (`bg-blue-600`, `text-gray-*`…)
 * ou hex cru — mesma disciplina de `ds-login-parity.test.ts` (Fase 1 / DS-MN-03).
 *
 * Cada USP estende `FILES` (nunca substitui as entradas anteriores) conforme
 * restiliza seus próprios arquivos — a lista cresce ao longo de T1..Tn de cada tasks.md.
 */

// 6 dígitos exatos (padrão de `ds-login-parity.test.ts`) — evita falso-positivo em
// referências de issue no JSDoc (ex.: `#165`), que podem coincidir com hex curto.
const HEX_COLOR_PATTERN = /#[0-9a-fA-F]{6}\b/;
const FIXED_PALETTE_PATTERN =
  /\b(?:bg|text|border|ring|from|to|via)-(?:blue|orange|slate|gray|grey|red|green)-\d{2,3}\b/;

interface FileGuard {
  /** Rótulo legível do arquivo (aparece no nome do teste). */
  label: string;
  /** Caminho relativo à raiz do repo. */
  path: string;
  /** Regexes de primitivos DS exigidos (vazio/omitido = sem verificação de primitivo). */
  requiredPrimitives?: RegExp[];
  /** Regexes de tags cruas proibidas (vazio/omitido = sem verificação de tag). */
  forbiddenRawTags?: RegExp[];
}

const FILES: FileGuard[] = [
  {
    label: 'JobForm (USP-020)',
    path: 'src/modules/jobs/components/job-form.tsx',
    requiredPrimitives: [/<Label\b/, /<Input\b/, /<Textarea\b/, /<Button\b/],
    // `<select>`/`<input type="hidden"|"checkbox">` continuam crus (sem primitivo DS
    // equivalente na fundação) — só label/textarea/button viram primitivo (U20-MN-04).
    forbiddenRawTags: [/<label\b/, /<textarea\b/, /<button\b/],
  },
];

describe('DS parity — vagas (USP-020/021/022, Fase 2)', () => {
  it.each(FILES)('$label ($path) não contém paleta crua nem hex', ({ path }) => {
    const content = readFileSync(join(process.cwd(), path), 'utf-8');
    expect(content).not.toMatch(FIXED_PALETTE_PATTERN);
    expect(content).not.toMatch(HEX_COLOR_PATTERN);
  });

  const withPrimitives = FILES.filter((f) => (f.requiredPrimitives?.length ?? 0) > 0);
  it.each(withPrimitives)('$label ($path) usa primitivos do DS (@/shared/ui)', ({ path, requiredPrimitives, forbiddenRawTags }) => {
    const content = readFileSync(join(process.cwd(), path), 'utf-8');
    expect(content).toMatch(/from ['"]@\/shared\/ui['"]/);
    for (const re of requiredPrimitives ?? []) {
      expect(content).toMatch(re);
    }
    for (const re of forbiddenRawTags ?? []) {
      expect(content).not.toMatch(re);
    }
  });
});
