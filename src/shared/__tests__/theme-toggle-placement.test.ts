import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * PROF-05 / PROF-MN-04 — Migração do `ThemeToggle` flutuante (USP-065 round 2).
 *
 * O `ThemeToggle` (`fixed bottom-4 right-4`) SHALL NOT montar no layout raiz
 * (onde alcançaria também `(app)/*`, sobrepondo a bottom tab bar em mobile —
 * PROF-MN-04); o `ThemeScript` (anti-FOUC) SHALL permanecer global no `<head>`
 * raiz. O toggle flutuante SHALL continuar montado em `(public)` e `(auth)`
 * — grupos sem Menu de Perfil (PROF-05). Em `(app)/*`, o único ponto de
 * montagem do controle de tema é o `ProfileMenu` (round 2 — PR #293 fix 2):
 * nenhum outro arquivo da casca `(app)` — layout, `AppShell`, `AppHeader`,
 * `AppSidebar` — pode montar um `<ThemeToggle>` solto (evita um segundo
 * controle de tema duplicado). Source-scan: molde dos guards existentes
 * (`readFileSync` + regex), agora contando ocorrências (não só boolean) para
 * pegar duplicação silenciosa, e cobrindo `(app)/*` explicitamente.
 *
 * `readFileSync` sem try/catch é proposital: se um destes arquivos for
 * renomeado/removido no futuro, o teste deve falhar com um erro claro
 * (ENOENT), nunca passar silenciosamente por "arquivo não encontrado, então
 * zero ocorrências".
 */

const THEME_TOGGLE_JSX_PATTERN = /<ThemeToggle\b/g;
const THEME_SCRIPT_JSX_PATTERN = /<ThemeScript\b/;

function countThemeToggleMounts(relativePath: string): number {
  const source = readFileSync(join(process.cwd(), relativePath), 'utf-8');
  return source.match(THEME_TOGGLE_JSX_PATTERN)?.length ?? 0;
}

describe('PROF-MN-04 — ThemeToggle flutuante ausente do layout raiz', () => {
  it('src/app/layout.tsx não monta <ThemeToggle> mas mantém <ThemeScript>', () => {
    expect(countThemeToggleMounts('src/app/layout.tsx')).toBe(0);
    const source = readFileSync(join(process.cwd(), 'src/app/layout.tsx'), 'utf-8');
    expect(THEME_SCRIPT_JSX_PATTERN.test(source)).toBe(true);
  });
});

describe('PROF-05 — ThemeToggle flutuante presente, exatamente 1x, em (public)/(auth)', () => {
  it('src/app/(public)/layout.tsx monta <ThemeToggle> exatamente 1x', () => {
    expect(countThemeToggleMounts('src/app/(public)/layout.tsx')).toBe(1);
  });

  it('src/app/(auth)/layout.tsx monta <ThemeToggle> exatamente 1x', () => {
    expect(countThemeToggleMounts('src/app/(auth)/layout.tsx')).toBe(1);
  });
});

describe('PROF-MN-04 (round 2) — (app)/* nunca monta <ThemeToggle> solto na chrome', () => {
  it.each([
    'src/app/(app)/layout.tsx',
    'src/app/(app)/_components/app-shell.tsx',
    'src/app/(app)/_components/app-header.tsx',
    'src/app/(app)/_components/app-sidebar.tsx',
  ])('%s não monta <ThemeToggle>', (relativePath) => {
    expect(countThemeToggleMounts(relativePath)).toBe(0);
  });
});

describe('PROF-05 (round 2) — ProfileMenu é o único ponto de montagem em (app)/*', () => {
  it('src/app/(app)/_components/profile-menu.tsx monta <ThemeToggle> exatamente 1x (sem duplicação)', () => {
    expect(countThemeToggleMounts('src/app/(app)/_components/profile-menu.tsx')).toBe(1);
  });
});
