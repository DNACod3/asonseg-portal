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
 * — grupos sem Menu de Perfil (PROF-05). Source-scan: molde dos guards
 * existentes (`readFileSync` + regex).
 */

const ROOT_LAYOUT = join(process.cwd(), 'src/app/layout.tsx');
const PUBLIC_LAYOUT = join(process.cwd(), 'src/app/(public)/layout.tsx');
const AUTH_LAYOUT = join(process.cwd(), 'src/app/(auth)/layout.tsx');

const THEME_TOGGLE_JSX_PATTERN = /<ThemeToggle\b/;
const THEME_SCRIPT_JSX_PATTERN = /<ThemeScript\b/;

describe('PROF-MN-04 — ThemeToggle flutuante ausente do layout raiz', () => {
  it('src/app/layout.tsx não monta <ThemeToggle> mas mantém <ThemeScript>', () => {
    const source = readFileSync(ROOT_LAYOUT, 'utf-8');
    expect(THEME_TOGGLE_JSX_PATTERN.test(source)).toBe(false);
    expect(THEME_SCRIPT_JSX_PATTERN.test(source)).toBe(true);
  });
});

describe('PROF-05 — ThemeToggle flutuante presente em (public)/(auth)', () => {
  it('src/app/(public)/layout.tsx monta <ThemeToggle>', () => {
    const source = readFileSync(PUBLIC_LAYOUT, 'utf-8');
    expect(THEME_TOGGLE_JSX_PATTERN.test(source)).toBe(true);
  });

  it('src/app/(auth)/layout.tsx monta <ThemeToggle>', () => {
    const source = readFileSync(AUTH_LAYOUT, 'utf-8');
    expect(THEME_TOGGLE_JSX_PATTERN.test(source)).toBe(true);
  });
});
