import { describe, it, expect } from 'vitest';
import { EDUCATION_LEVELS } from '@/modules/persons';
import { EDUCATION_LEVELS_CV } from '../confirm-cv-fields.schema';

/**
 * Guarda de sincronia (CVE-04): `EDUCATION_LEVELS_CV` é uma cópia intencional
 * do enum canônico `EDUCATION_LEVELS` de `persons` — duplicado (não importado)
 * para não arrastar código server-only de `@/modules/persons` ao bundle do
 * `CvUploadForm` (Client Component). Este teste roda no servidor (pode importar
 * o barrel) e mata o risco de drift silencioso entre as duas cópias: se alguém
 * mexer numa lista de escolaridade sem espelhar na outra, o CI quebra aqui.
 */
describe('CVE-04 — EDUCATION_LEVELS_CV espelha o enum canônico de persons', () => {
  it('tem exatamente os mesmos valores, na mesma ordem', () => {
    expect([...EDUCATION_LEVELS_CV]).toEqual([...EDUCATION_LEVELS]);
  });
});
