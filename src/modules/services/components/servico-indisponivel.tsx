import Link from 'next/link';
import { Button, Card } from '@/shared/ui';

/**
 * Estado "serviço indisponível" (SVC031-MN-02 — não-ACTIVE, prestador
 * inativado ou inexistente). Mensagem clara + caminho para outros serviços,
 * NUNCA um 404 técnico. Espelha `VagaIndisponivel` (`(public)/vagas/[id]`).
 */
export function ServicoIndisponivel() {
  return (
    <Card className="flex flex-col items-start gap-4">
      <div>
        <h1 className="text-xl font-bold text-fg">Serviço indisponível</h1>
        <p className="mt-2 text-sm text-fg-muted">
          Este serviço não está mais disponível ou foi temporariamente removido. Veja outros
          serviços oferecidos na região.
        </p>
      </div>
      <Button variant="primary" asChild>
        <Link href="/servicos">Ver outros serviços</Link>
      </Button>
    </Card>
  );
}
