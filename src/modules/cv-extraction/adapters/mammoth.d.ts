/**
 * `mammoth` não publica tipos próprios nem `@types/mammoth` (verificado —
 * pacote inexistente no registro npm). Declaração mínima do único símbolo
 * usado pelo adapter Anthropic (DOCX → texto, USP-040 / A-08).
 */
declare module 'mammoth' {
  export interface ExtractRawTextResult {
    value: string;
    messages: unknown[];
  }

  export function extractRawText(input: { buffer: Buffer }): Promise<ExtractRawTextResult>;
}
