import { Card } from '@/shared/ui';
import type { ServiceListItem } from '../views/service-list-item.view';
import { ServiceCard } from './service-card';

/**
 * Lista de serviços da busca pública (USP-030). Renderiza os cartões ou o
 * estado vazio (edge case da spec: filtros sem resultado → sem erro). Os itens
 * já vêm projetados pelo View Model.
 */
export function ServiceList({ services }: Readonly<{ services: ServiceListItem[] }>) {
  if (services.length === 0) {
    return (
      <Card className="border-dashed p-10 text-center">
        <p className="text-base font-medium text-fg">Nenhum serviço encontrado</p>
        <p className="mt-1 text-sm text-fg-muted">
          Tente ajustar os filtros ou limpar a busca para ver todos os serviços.
        </p>
      </Card>
    );
  }

  return (
    <ul className="flex flex-col gap-4">
      {services.map((service) => (
        <li key={service.id}>
          <ServiceCard service={service} />
        </li>
      ))}
    </ul>
  );
}
