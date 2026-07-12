import type { Metadata } from 'next';
import { FormHeader } from '@/shared/ui';

/**
 * Placeholder honesto de `/termos` (USP-059 — AUTH-2). Página estática:
 * mata o link morto do cadastro (`RegisterPersonForm.tsx:221`) sem inventar
 * texto jurídico — o conteúdo real é dependência externa (D-002, gate
 * humano). CASCA59-MN-02: nenhum corpo de termo de consentimento é
 * carregado aqui e não há qualquer ação de aceite/consentimento.
 */
export const metadata: Metadata = {
  title: 'Termos de Uso | ASONSEG',
  description: 'Termos de uso do Portal ASONSEG.',
};

export default function TermosPage() {
  return (
    <div className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6">
      <FormHeader title="Termos de Uso" />
      <p className="text-fg-muted">
        Este documento está em elaboração e ficará disponível em breve.
      </p>
    </div>
  );
}
