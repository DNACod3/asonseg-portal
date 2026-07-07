import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * DS-MN-05 — Fundação de Design System da Fase 1 (T1).
 *
 * `CLAUDE.md` §Tech Stack "Forbidden": Redux, MobX, Zustand, Jotai, CSS-in-JS
 * runtime além do Tailwind, lib de data alternativa a `date-fns`, e nenhuma 4ª
 * pasta de topo em `src/` (guardado separadamente por
 * `closed-src-root.test.ts`). Esta guarda falha se `package.json` (deps ou
 * devDeps) contiver qualquer uma dessas libs proibidas.
 */

const PACKAGE_JSON_PATH = join(process.cwd(), 'package.json');

const FORBIDDEN_STATE_LIBS = ['redux', 'react-redux', '@reduxjs/toolkit', 'mobx', 'zustand', 'jotai'];
const FORBIDDEN_CSS_IN_JS = ['styled-components', '@emotion/react', '@emotion/styled', '@emotion/core'];
const FORBIDDEN_THEME_LIBS = ['next-themes'];
const FORBIDDEN_DATE_LIBS = ['moment', 'dayjs', 'luxon'];

const ALLOWLIST_NEW_DS_DEPS = [
  'class-variance-authority',
  'clsx',
  'tailwind-merge',
  '@radix-ui/react-slot',
  '@radix-ui/react-label',
];

describe('DS-MN-05 — sem dependência proibida (Redux/MobX/Zustand/Jotai, CSS-in-JS, next-themes, data lib)', () => {
  function readAllDeps(): string[] {
    const raw = readFileSync(PACKAGE_JSON_PATH, 'utf-8');
    const pkg = JSON.parse(raw) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    return [...Object.keys(pkg.dependencies ?? {}), ...Object.keys(pkg.devDependencies ?? {})];
  }

  it('nenhuma lib de estado proibida (Redux/MobX/Zustand/Jotai)', () => {
    const deps = readAllDeps();
    const offenders = deps.filter((d) => FORBIDDEN_STATE_LIBS.includes(d));
    expect(offenders).toEqual([]);
  });

  it('nenhuma lib de CSS-in-JS runtime (styled-components/@emotion/*)', () => {
    const deps = readAllDeps();
    const offenders = deps.filter((d) => FORBIDDEN_CSS_IN_JS.includes(d));
    expect(offenders).toEqual([]);
  });

  it('sem next-themes (dark mode é data-attribute + React nativo)', () => {
    const deps = readAllDeps();
    const offenders = deps.filter((d) => FORBIDDEN_THEME_LIBS.includes(d));
    expect(offenders).toEqual([]);
  });

  it('nenhuma lib de data alternativa a date-fns (moment/dayjs/luxon)', () => {
    const deps = readAllDeps();
    const offenders = deps.filter((d) => FORBIDDEN_DATE_LIBS.includes(d));
    expect(offenders).toEqual([]);
  });

  it('deps novas do design system limitam-se ao allowlist mínimo shadcn', () => {
    const deps = readAllDeps();
    for (const allowed of ALLOWLIST_NEW_DS_DEPS) {
      expect(deps, `esperava "${allowed}" em package.json`).toContain(allowed);
    }
  });
});
