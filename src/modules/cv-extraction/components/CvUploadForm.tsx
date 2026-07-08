'use client';

import { useRef, useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button, Input, Label, Textarea } from '@/shared/ui';
import { uploadCv } from '../actions/upload-cv';
import { extractCvFromUpload } from '../actions/extract-cv';
import { confirmCvFields } from '../actions/confirm-cv-fields';
import {
  confirmCvFieldsSchema,
  type ConfirmCvFieldsInput,
} from '../schemas/confirm-cv-fields.schema';

const selectClass =
  'w-full rounded-sm border-[1.5px] border-border bg-surface px-4 py-3 text-[0.95rem] text-fg transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary disabled:cursor-not-allowed disabled:opacity-60';
const errorClass = 'mt-1 text-xs text-danger';

/**
 * Espelha `EDUCATION_LEVELS`/`EDUCATION_LEVEL_LABELS` de
 * `persons/domain/candidate.ts` — duplicado intencionalmente (não importado)
 * para manter este Client Component livre de dependência do barrel de
 * `persons`, que reexporta queries com IO de Prisma (`searchCandidates`) e
 * quebraria o bundle do cliente (mesma classe de problema documentada em
 * `persons/components/candidate-form.tsx`). `confirmCvFieldsSchema` valida o
 * valor final contra o enum real — esta lista só alimenta o `<select>`.
 */
const EDUCATION_LEVELS_UI = [
  'ENSINO_FUNDAMENTAL',
  'ENSINO_MEDIO',
  'ENSINO_TECNICO',
  'ENSINO_SUPERIOR',
  'POS_GRADUACAO',
] as const;

const EDUCATION_LEVEL_LABELS_UI: Record<(typeof EDUCATION_LEVELS_UI)[number], string> = {
  ENSINO_FUNDAMENTAL: 'Ensino Fundamental',
  ENSINO_MEDIO: 'Ensino Médio',
  ENSINO_TECNICO: 'Ensino Técnico',
  ENSINO_SUPERIOR: 'Ensino Superior',
  POS_GRADUACAO: 'Pós-graduação',
};

type Stage = 'idle' | 'uploading' | 'extracting' | 'ready';

export interface CvUploadFormProps {
  /** Chamado após a confirmação bem-sucedida dos campos (ex.: `router.refresh()`). */
  onConfirmed?: () => void;
}

/**
 * Upload → extração → pré-preenchimento → confirmação de CV (USP-040, CVE-01
 * a CVE-05). Orquestra as 3 Server Actions do módulo em sequência.
 *
 * A extração **nunca grava nada sozinha** (CVE-MN-01) — o formulário só fica
 * editável após o retorno da extração, e é o botão "Confirmar" (via
 * `confirmCvFields`) que persiste. Falha/vazio da IA cai em fallback
 * gracioso: mensagem amigável + campos vazios editáveis, sem erro disruptivo
 * (CVE-MN-06) — o cadastro segue completável manualmente.
 */
export function CvUploadForm({ onConfirmed }: CvUploadFormProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();
  const [stage, setStage] = useState<Stage>('idle');
  const [serverError, setServerError] = useState<string | null>(null);
  const [aiSuggested, setAiSuggested] = useState(false);
  const [fallbackMessage, setFallbackMessage] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ConfirmCvFieldsInput>({
    resolver: zodResolver(confirmCvFieldsSchema),
  });

  function onUploadClick() {
    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      setServerError('Selecione um arquivo de CV (PDF, DOC ou DOCX).');
      return;
    }
    setServerError(null);
    setFallbackMessage(null);
    setConfirmed(false);
    setStage('uploading');

    startTransition(async () => {
      const formData = new FormData();
      formData.set('file', file);
      const uploadResult = await uploadCv(formData);
      if (!uploadResult.ok) {
        setServerError(uploadResult.error.message);
        setStage('idle');
        return;
      }

      setStage('extracting');
      const extractResult = await extractCvFromUpload();
      if (!extractResult.ok) {
        setServerError(extractResult.error.message);
        setStage('idle');
        return;
      }

      if (extractResult.data.fallback || !extractResult.data.extracted) {
        setFallbackMessage(
          'Não conseguimos extrair os dados automaticamente do seu currículo. Preencha os campos manualmente abaixo.',
        );
        setAiSuggested(false);
        reset({});
      } else {
        const extracted = extractResult.data.extracted;
        setAiSuggested(true);
        reset({
          educationLevel: (extracted.educationLevel ?? undefined) as ConfirmCvFieldsInput['educationLevel'],
          educationArea: extracted.educationArea ?? undefined,
          experienceText: extracted.experienceText ?? undefined,
          skillsText: extracted.skillsText ?? undefined,
          coursesText: extracted.coursesText ?? undefined,
        });
      }
      setStage('ready');
    });
  }

  function onSubmit(data: ConfirmCvFieldsInput) {
    setServerError(null);
    startTransition(async () => {
      const result = await confirmCvFields(data);
      if (!result.ok) {
        setServerError(result.error.message);
        return;
      }
      setConfirmed(true);
      onConfirmed?.();
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <Label htmlFor="cv-file">Currículo (PDF, DOC ou DOCX)</Label>
        <input
          id="cv-file"
          ref={fileInputRef}
          type="file"
          accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          className="block w-full text-sm text-fg-muted"
        />
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="mt-2"
          onClick={onUploadClick}
          disabled={isPending}
        >
          {stage === 'uploading'
            ? 'Enviando…'
            : stage === 'extracting'
              ? 'Extraindo dados do currículo…'
              : 'Enviar e extrair dados'}
        </Button>
      </div>

      {(stage === 'uploading' || stage === 'extracting') && (
        <div role="status" className="text-sm text-fg-muted">
          {stage === 'uploading' ? 'Enviando currículo…' : 'Extraindo dados do currículo…'}
        </div>
      )}

      {fallbackMessage && (
        <div
          role="status"
          className="rounded-md border border-border bg-background px-4 py-3 text-sm text-fg-muted"
        >
          {fallbackMessage}
        </div>
      )}

      {stage === 'ready' && (
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          {aiSuggested && (
            <p className="text-xs font-medium text-primary">
              Campos sugeridos pela IA — revise antes de confirmar.
            </p>
          )}

          <div>
            <Label htmlFor="educationLevel">Escolaridade</Label>
            <select
              id="educationLevel"
              className={selectClass}
              defaultValue=""
              {...register('educationLevel')}
            >
              <option value="">Selecione…</option>
              {EDUCATION_LEVELS_UI.map((level) => (
                <option key={level} value={level}>
                  {EDUCATION_LEVEL_LABELS_UI[level]}
                </option>
              ))}
            </select>
            {errors.educationLevel && <p className={errorClass}>{errors.educationLevel.message}</p>}
          </div>

          <div>
            <Label htmlFor="educationArea">
              Área de formação <span className="font-normal text-fg-muted">(opcional)</span>
            </Label>
            <Input id="educationArea" type="text" {...register('educationArea')} />
            {errors.educationArea && <p className={errorClass}>{errors.educationArea.message}</p>}
          </div>

          <div>
            <Label htmlFor="experienceText">
              Experiência <span className="font-normal text-fg-muted">(opcional)</span>
            </Label>
            <Textarea id="experienceText" rows={3} {...register('experienceText')} />
            {errors.experienceText && <p className={errorClass}>{errors.experienceText.message}</p>}
          </div>

          <div>
            <Label htmlFor="skillsText">
              Habilidades <span className="font-normal text-fg-muted">(opcional)</span>
            </Label>
            <Textarea id="skillsText" rows={2} {...register('skillsText')} />
            {errors.skillsText && <p className={errorClass}>{errors.skillsText.message}</p>}
          </div>

          <div>
            <Label htmlFor="coursesText">
              Cursos complementares <span className="font-normal text-fg-muted">(opcional)</span>
            </Label>
            <Textarea id="coursesText" rows={2} {...register('coursesText')} />
            {errors.coursesText && <p className={errorClass}>{errors.coursesText.message}</p>}
          </div>

          {serverError && (
            <div
              role="alert"
              className="rounded-lg bg-[color-mix(in_srgb,var(--color-danger)_10%,transparent)] p-3 text-sm text-danger"
            >
              {serverError}
            </div>
          )}

          <Button type="submit" variant="primary" disabled={isPending}>
            {isPending ? 'Salvando…' : 'Confirmar dados do currículo'}
          </Button>

          {confirmed && (
            <div
              role="status"
              className="rounded-md border border-primary bg-[color-mix(in_srgb,var(--color-primary)_10%,transparent)] px-4 py-3 text-sm text-primary"
            >
              Dados do currículo confirmados.
            </div>
          )}
        </form>
      )}

      {serverError && stage !== 'ready' && (
        <div
          role="alert"
          className="rounded-lg bg-[color-mix(in_srgb,var(--color-danger)_10%,transparent)] p-3 text-sm text-danger"
        >
          {serverError}
        </div>
      )}
    </div>
  );
}
