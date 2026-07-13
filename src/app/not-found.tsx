import Link from 'next/link';
import { SiteHeader } from './(public)/_components/site-header';
import { SiteFooter } from './(public)/_components/site-footer';
import { Button, FormHeader } from '@/shared/ui';

/**
 * Página 404 global (USP-059 — PUB-3/SOC-3). Server Component estático, sem
 * `'use client'` — renderiza dentro do root layout (`src/app/layout.tsx`),
 * acionada por rotas inexistentes e por `notFound()` não capturado por um
 * `not-found` mais próximo (decisão A9). Como o root `not-found` não é
 * envolvido pelo `(public)/layout.tsx`, a casca é montada aqui reusando os
 * mesmos componentes estáticos do grupo público.
 *
 * CASCA59-MN-01: não resolve a Pessoa autenticada, não consome View Model/
 * Prisma/Server Action, nem renderiza qualquer dado autenticado/PII —
 * `SiteHeader` e `SiteFooter` já são estáticos (guards CASCA-MN-01).
 */
export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <main>
        <div className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center gap-6 px-4 py-8 text-center sm:px-6">
          <FormHeader
            title="Página não encontrada"
            description="A página que você procura não existe ou foi movida."
          />
          <Button asChild>
            <Link href="/">Voltar para a home</Link>
          </Button>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
