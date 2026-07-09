import { describe, it, expect } from 'vitest';
import { viewClientForProvider } from '../views/client-for-provider.view';

// FACTS (USP-035 / AC-035-2) — serializer puro do cliente para o prestador. O
// recorte de PII (cpf/birthDate/fullAddress ausentes) acontece no `select` da
// query (list-provider-interests.ts); este teste só garante a projeção de shape.
describe('viewClientForProvider — View Model (AC-035-2)', () => {
  it('projeta interestId + clientName + contact + interestedAt + service', () => {
    const interestedAt = new Date('2026-07-01T10:00:00Z');
    const view = viewClientForProvider({
      interestId: 'int-1',
      clientName: 'Maria Cliente',
      phone: '11988887777',
      email: 'maria@example.com',
      interestedAt,
      service: { id: 'svc-1', title: 'Jardinagem' },
    });

    expect(view).toEqual({
      interestId: 'int-1',
      clientName: 'Maria Cliente',
      contact: { phone: '11988887777', email: 'maria@example.com' },
      interestedAt,
      service: { id: 'svc-1', title: 'Jardinagem' },
    });
  });

  it('phone/email nulos são projetados como null (não informado)', () => {
    const view = viewClientForProvider({
      interestId: 'int-2',
      clientName: 'João Cliente',
      phone: null,
      email: null,
      interestedAt: new Date('2026-07-01T10:00:00Z'),
      service: { id: 'svc-2', title: 'Pintura' },
    });

    expect(view.contact).toEqual({ phone: null, email: null });
  });
});
