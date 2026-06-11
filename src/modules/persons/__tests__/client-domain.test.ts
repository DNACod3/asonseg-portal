import { describe, it, expect } from 'vitest';
import { decideClientActivation } from '../domain/client';

describe('decideClientActivation — regra pura (USP-011 / E-002)', () => {
  it('indica needsActivation=true quando CLIENT está ausente', () => {
    expect(decideClientActivation(['CANDIDATE'])).toEqual({ needsActivation: true });
  });

  it('indica needsActivation=false quando CLIENT já está presente', () => {
    expect(decideClientActivation(['CLIENT'])).toEqual({ needsActivation: false });
  });

  it('é idempotente com múltiplos papéis coexistindo', () => {
    expect(decideClientActivation(['CANDIDATE', 'CLIENT'])).toEqual({ needsActivation: false });
  });

  it('indica needsActivation=true para Pessoa sem nenhum papel', () => {
    expect(decideClientActivation([])).toEqual({ needsActivation: true });
  });
});
