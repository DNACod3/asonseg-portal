import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import TermosPage from '../termos/page';
import PrivacidadePage from '../privacidade/page';

/**
 * USP-059 — `/termos` e `/privacidade` (AUTH-2, CASCA59-MN-02). Server
 * Components estáticos sem IO: render direto, sem mock.
 */

const PLACEHOLDER_TEXT = 'Este documento está em elaboração e ficará disponível em breve.';

describe.each([
  { name: 'TermosPage', Page: TermosPage, title: 'Termos de Uso' },
  { name: 'PrivacidadePage', Page: PrivacidadePage, title: 'Política de Privacidade' },
])('$name — placeholder honesto (AUTH2-1/2, MN-02)', ({ Page, title }) => {
  it('renderiza título + aviso PT-BR "em elaboração"', () => {
    render(<Page />);
    expect(screen.getByText(title)).toBeInTheDocument();
    expect(screen.getByText(PLACEHOLDER_TEXT)).toBeInTheDocument();
  });

  it('CASCA59-MN-02: não oferece controle de aceite/checkbox/botão de consentimento', () => {
    render(<Page />);
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});

describe('CASCA59-MN-02 — sem carregamento de corpo de termo (AUTH2-3)', () => {
  it('source das páginas não importa loadTerm/LgpdBox/legal/consent-terms', async () => {
    const { readFileSync } = await import('node:fs');
    const { join } = await import('node:path');
    const files = [
      join(process.cwd(), 'src/app/(public)/termos/page.tsx'),
      join(process.cwd(), 'src/app/(public)/privacidade/page.tsx'),
    ];
    for (const file of files) {
      const content = readFileSync(file, 'utf-8');
      expect(content).not.toMatch(/\bloadTerm\b/);
      expect(content).not.toMatch(/\bLgpdBox\b/);
      expect(content).not.toMatch(/legal\/consent-terms/);
    }
  });
});
