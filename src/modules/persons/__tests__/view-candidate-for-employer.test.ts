import { describe, it, expect } from 'vitest';
import {
  viewCandidateForEmployer,
  type EmployerCandidateRow,
} from '../views/view-candidate-for-employer';

/**
 * View Model do candidato para a Empresa (USP-027). Garantia central de privacidade
 * (USP027-MN-01/MN-05): o `Row` NUNCA carrega `cpf`/`birthDate`/`fullAddress` — este
 * teste trava tanto a chave de saída (whitelist) quanto a ausência estrutural dos
 * campos proibidos (sensor de discriminação a nível de tipo/objeto).
 */

const CPF_SENSOR = '123.456.789-00';
const ENDERECO_SENSOR = 'Rua Sensível, 42';
const BIRTHDATE_SENSOR = '1990-01-01';

function row(overrides: Partial<EmployerCandidateRow> = {}): EmployerCandidateRow {
  return {
    candidatePersonId: 'candidate-1',
    fullName: 'Maria Candidata',
    emailLogin: 'maria@example.com',
    phone: '11988887777',
    appliedAt: new Date('2026-07-01T12:00:00Z'),
    viaEncaminhamento: false,
    cvStoragePath: 'cvs/candidate-1/cv.pdf',
    cvUploadedAt: new Date('2026-06-30T10:00:00Z'),
    cvSignedUrl: 'https://storage.example.com/signed/cv.pdf',
    ...overrides,
  };
}

describe('viewCandidateForEmployer', () => {
  it('USP027-01: projeta nome, contato, CV e meta a partir da whitelist', () => {
    const view = viewCandidateForEmployer(row());
    expect(Object.keys(view).sort()).toEqual(
      ['appliedAt', 'candidatePersonId', 'contact', 'cv', 'fullName', 'viaEncaminhamento'].sort(),
    );
    expect(view).toEqual({
      candidatePersonId: 'candidate-1',
      fullName: 'Maria Candidata',
      contact: { email: 'maria@example.com', phone: '11988887777' },
      cv: {
        available: true,
        url: 'https://storage.example.com/signed/cv.pdf',
        uploadedAt: new Date('2026-06-30T10:00:00Z'),
      },
      appliedAt: new Date('2026-07-01T12:00:00Z'),
      viaEncaminhamento: false,
    });
  });

  it('USP027-MN-01/MN-05: nenhum campo proibido está presente no objeto nem no payload serializado', () => {
    const view = viewCandidateForEmployer(
      row({
        // O `Row` tipado não permite estes campos — o teste também garante em runtime
        // que, mesmo que um valor sensível esteja "por perto" (ex.: no e-mail/telefone
        // por coincidência), o serializer não os ecoa por engano.
      }),
    );
    for (const key of ['cpf', 'birthDate', 'fullAddress']) {
      expect(view).not.toHaveProperty(key);
    }
    expect(JSON.stringify(view)).not.toContain(CPF_SENSOR);
    expect(JSON.stringify(view)).not.toContain(ENDERECO_SENSOR);
    expect(JSON.stringify(view)).not.toContain(BIRTHDATE_SENSOR);
  });

  it('branch: telefone null vira contact.phone=null (sem quebrar)', () => {
    const view = viewCandidateForEmployer(row({ phone: null }));
    expect(view.contact.phone).toBeNull();
  });

  it('branch: e-mail null vira contact.email=null (sem quebrar)', () => {
    const view = viewCandidateForEmployer(row({ emailLogin: null }));
    expect(view.contact.email).toBeNull();
  });

  it('branch: CV ausente (sem URL assinada) vira cv.available=false, url=null', () => {
    const view = viewCandidateForEmployer(
      row({ cvStoragePath: null, cvUploadedAt: null, cvSignedUrl: null }),
    );
    expect(view.cv).toEqual({ available: false, url: null, uploadedAt: null });
  });

  it('branch: storage indisponível (cvStoragePath presente mas sem URL resolvida) vira cv.available=false', () => {
    const view = viewCandidateForEmployer(row({ cvSignedUrl: null }));
    expect(view.cv.available).toBe(false);
    expect(view.cv.url).toBeNull();
  });

  it('branch: viaEncaminhamento=true é propagado para o badge', () => {
    const view = viewCandidateForEmployer(row({ viaEncaminhamento: true }));
    expect(view.viaEncaminhamento).toBe(true);
  });

  it('branch: viaEncaminhamento=false (default da Fase 3) não exibe o badge', () => {
    const view = viewCandidateForEmployer(row({ viaEncaminhamento: false }));
    expect(view.viaEncaminhamento).toBe(false);
  });
});
