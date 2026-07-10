import { Button, Input, Label, cn } from '@/shared/ui';

/**
 * USP-047 (T1, HOME-03/HOME-13/HOME-14). `<form role="search">` do hero:
 * `<input name="q">` rotulado (label acessível, `sr-only` — o placeholder já
 * comunica visualmente) + botão de submit. Server Component estático — GET
 * declarativo, sem handler client (degrada graciosamente sem JS).
 *
 * `action`/`placeholder` são seams (props com default de rota real, A-06):
 * o default `/vagas` já lê `?q=` (`(public)/vagas/page.tsx`), então a busca
 * é funcional sem a USP-048; a USP-048 pode retargetar `action` para um
 * escopo integrado (vagas+serviços) sem reescrever este componente.
 */
export interface HomeSearchProps {
  action?: string;
  placeholder?: string;
  className?: string;
}

export function HomeSearch({
  action = '/vagas',
  placeholder = 'Busque por cargo, área ou palavra-chave…',
  className,
}: HomeSearchProps) {
  return (
    <form
      role="search"
      method="get"
      action={action}
      className={cn('flex w-full max-w-xl flex-col gap-2 sm:flex-row sm:items-end', className)}
    >
      <div className="flex-1">
        <Label htmlFor="home-search-q" className="sr-only">
          Buscar vagas
        </Label>
        <Input
          id="home-search-q"
          type="search"
          name="q"
          placeholder={placeholder}
        />
      </div>
      <Button type="submit" variant="primary">
        Buscar
      </Button>
    </form>
  );
}
