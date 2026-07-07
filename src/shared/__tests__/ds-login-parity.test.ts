import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * DS-MN-03 — Fundação de Design System da Fase 1 (T13).
 *
 * A tela de login (page + `LoginForm`) SHALL NOT reter utilitários de
 * paleta crua (`bg-blue-600`, `text-gray-*`, `ring-blue-*`, `system-ui`) nem
 * hex cru — smoke que a fundação de fato substituiu o estilo ad-hoc.
 */

const LOGIN_FILES = [
  join(process.cwd(), 'src/app/(auth)/login/page.tsx'),
  join(process.cwd(), 'src/modules/identity/components/LoginForm.tsx'),
];

const HEX_COLOR_PATTERN = /#[0-9a-fA-F]{6}\b/;
const FIXED_PALETTE_PATTERN =
  /\b(?:bg|text|border|ring)-(?:blue|orange|slate|gray|grey|red|green)-\d{2,3}\b/;
const SYSTEM_UI_PATTERN = /system-ui/;

describe('DS-MN-03 — login sem paleta crua (bg-blue-600/text-gray-*/ring-blue-*/system-ui)', () => {
  it.each(LOGIN_FILES)('%s não contém utilitário de paleta fixa nem system-ui', (file) => {
    const content = readFileSync(file, 'utf-8');
    expect(content).not.toMatch(FIXED_PALETTE_PATTERN);
    expect(content).not.toMatch(SYSTEM_UI_PATTERN);
  });

  it.each(LOGIN_FILES)('%s não contém hex cru (#RRGGBB)', (file) => {
    const content = readFileSync(file, 'utf-8');
    expect(content).not.toMatch(HEX_COLOR_PATTERN);
  });

  it('LoginForm usa os primitivos Input/Label/Button da fundação (não <input>/<label>/<button> crus)', () => {
    const loginForm = readFileSync(
      join(process.cwd(), 'src/modules/identity/components/LoginForm.tsx'),
      'utf-8',
    );
    expect(loginForm).toMatch(/from ['"]@\/shared\/ui['"]/);
    expect(loginForm).toMatch(/<Input\b/);
    expect(loginForm).toMatch(/<Label\b/);
    expect(loginForm).toMatch(/<Button\b/);
    expect(loginForm).not.toMatch(/<input\b/);
    expect(loginForm).not.toMatch(/<label\b/);
    expect(loginForm).not.toMatch(/<button\b/);
  });
});
