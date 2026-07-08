import { describe, it, expect } from 'vitest';
import { viewProviderContactForClient } from '../views/provider-contact.view';

// FACTS (USP-033 / AC-033-5, SVC033-MN-01) — serializer puro do contato do
// prestador. O recorte de campos entitled acontece no `select` da query
// (get-provider-contact.ts); este teste só garante a projeção de shape.
describe('viewProviderContactForClient — View Model (AC-033-5)', () => {
  it('projeta displayName + phone + email do prestador', () => {
    const view = viewProviderContactForClient({
      displayName: 'João Prestador',
      phone: '11988887777',
      email: 'joao@example.com',
    });

    expect(view).toEqual({
      displayName: 'João Prestador',
      phone: '11988887777',
      email: 'joao@example.com',
    });
  });

  it('SVC033-MN-01: phone/email nulos são projetados como null (nunca omitidos silenciosamente)', () => {
    const view = viewProviderContactForClient({
      displayName: 'Empresa X',
      phone: null,
      email: null,
    });

    expect(view.phone).toBeNull();
    expect(view.email).toBeNull();
  });
});
