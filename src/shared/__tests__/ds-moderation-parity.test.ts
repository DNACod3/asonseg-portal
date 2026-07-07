import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * DS-16-MN-1 — restyle da fila de moderação (USP-016, Fase 2, AD-014/AD-015).
 *
 * A fila do coordenador (`moderation-queue.tsx`) e a página da rota
 * (`(app)/moderacao/page.tsx`) SHALL NOT reter utilitário de paleta crua
 * (`bg-blue-600`, `text-gray-*`, `border-amber-300`…) nem hex cru — smoke que
 * o restyle de fato substituiu a paleta ad-hoc por tokens/primitivos do
 * Design System. Mesmo padrão de `ds-login-parity.test.ts`.
 *
 * A USP-017 (T3) estende `MODERATION_FILES` com `verification-panel.tsx`
 * quando restilizar esse componente (DS-17-MN-1) — ver design.md §8.4.
 */

const MODERATION_FILES = [
  join(process.cwd(), 'src/modules/moderation/components/moderation-queue.tsx'),
  join(process.cwd(), 'src/app/(app)/moderacao/page.tsx'),
];

const HEX_COLOR_PATTERN = /#[0-9a-fA-F]{6}\b/;
const FIXED_PALETTE_PATTERN = /\b(?:bg|text|border|ring)-(?:gray|slate|blue|green|amber|red)-[0-9]{2,3}\b/;

describe('DS-16-MN-1 — fila de moderação sem paleta crua (bg-*/text-*/border-*/ring-*-NNN, hex cru)', () => {
  it.each(MODERATION_FILES)('%s não contém utilitário de paleta fixa', (file) => {
    const content = readFileSync(file, 'utf-8');
    expect(content).not.toMatch(FIXED_PALETTE_PATTERN);
  });

  it.each(MODERATION_FILES)('%s não contém hex cru (#RRGGBB)', (file) => {
    const content = readFileSync(file, 'utf-8');
    expect(content).not.toMatch(HEX_COLOR_PATTERN);
  });

  it('moderation-queue usa os primitivos Badge/Button/Label/Textarea da fundação (não <button>/<textarea> crus para as ações)', () => {
    const content = readFileSync(
      join(process.cwd(), 'src/modules/moderation/components/moderation-queue.tsx'),
      'utf-8',
    );
    expect(content).toMatch(/from ['"]@\/shared\/ui['"]/);
    expect(content).toMatch(/<Badge\b/);
    expect(content).toMatch(/<Button\b/);
    expect(content).toMatch(/<Textarea\b/);
    expect(content).not.toMatch(/<button\b/);
    expect(content).not.toMatch(/<textarea\b/);
  });
});
