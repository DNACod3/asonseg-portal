import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

/**
 * USP-046 T5 — PublicLayout (CASCA-12/13/14). `usePathname` mockado porque
 * o layout monta `SiteHeader` → `PublicNav` (Client Component, T2).
 */
vi.mock('next/navigation', () => ({
  usePathname: () => '/',
}));

const { default: PublicLayout } = await import('../layout');

describe('PublicLayout — montagem única header→main→footer (CASCA-12)', () => {
  it('monta SiteHeader, um único <main> com os children, e SiteFooter — nessa ordem', () => {
    render(
      <PublicLayout>
        <div data-testid="page-content">Conteúdo da página</div>
      </PublicLayout>,
    );

    const header = screen.getByRole('banner');
    const main = screen.getByRole('main');
    const footer = screen.getByRole('contentinfo');

    expect(header).toBeInTheDocument();
    expect(main).toBeInTheDocument();
    expect(footer).toBeInTheDocument();
    expect(main).toContainElement(screen.getByTestId('page-content'));

    // ordem no DOM: header → main → footer.
    expect(header.compareDocumentPosition(main) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(main.compareDocumentPosition(footer) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});

describe('PublicLayout — ISR preservado por página (CASCA-13)', () => {
  it('o arquivo do layout não declara export const revalidate', () => {
    const source = readFileSync(join(process.cwd(), 'src/app/(public)/layout.tsx'), 'utf-8');
    expect(source).not.toMatch(/export const revalidate/);
  });
});
