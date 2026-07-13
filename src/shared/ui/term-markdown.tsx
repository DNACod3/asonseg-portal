import { Fragment } from 'react';
import { cn } from './cn';

/**
 * Renderer mínimo de Markdown para o corpo dos termos de consentimento
 * (USP-059 — AUTH-6/EMP-7). Cobre **apenas** os construtos usados nos
 * termos existentes (`legal/consent-terms`, um `v1.0.md` por finalidade):
 * H1 (`#`), H2 (`##`),
 * negrito (`**`), lista não-ordenada (`- `), citação (`> `), régua (`---`),
 * código inline (`` ` ``) e parágrafos. **Sem dependência nova**
 * (CASCA59-MN-03) — `parseTermMarkdown` é uma função pura, sem lib de
 * Markdown.
 *
 * CASCA59-MN-04: renderiza só React elements a partir do texto (nunca
 * `dangerouslySetInnerHTML`) — qualquer trecho `<...>` do conteúdo do termo
 * é tratado como texto puro pelo parser e o React o escapa automaticamente
 * ao renderizar, então HTML-like no corpo do termo nunca vira elemento real.
 * Construtos não reconhecidos (AUTH6-3) degradam para parágrafo de texto
 * inerte — nunca lançam.
 */

export type InlineSpan =
  | { type: 'text'; value: string }
  | { type: 'bold'; value: string }
  | { type: 'code'; value: string };

export type TermBlock =
  | { type: 'heading1'; spans: InlineSpan[] }
  | { type: 'heading2'; spans: InlineSpan[] }
  | { type: 'list'; items: InlineSpan[][] }
  | { type: 'blockquote'; spans: InlineSpan[] }
  | { type: 'hr' }
  | { type: 'paragraph'; spans: InlineSpan[] };

const INLINE_PATTERN = /\*\*(.+?)\*\*|`([^`]+)`/g;

/** Quebra uma linha de texto em spans `text|bold|code` (negrito e código inline). */
function parseInline(text: string): InlineSpan[] {
  const spans: InlineSpan[] = [];
  let lastIndex = 0;
  INLINE_PATTERN.lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = INLINE_PATTERN.exec(text)) !== null) {
    if (match.index > lastIndex) {
      spans.push({ type: 'text', value: text.slice(lastIndex, match.index) });
    }
    if (match[1] !== undefined) {
      spans.push({ type: 'bold', value: match[1] });
    } else if (match[2] !== undefined) {
      spans.push({ type: 'code', value: match[2] });
    }
    lastIndex = INLINE_PATTERN.lastIndex;
  }
  if (lastIndex < text.length) {
    spans.push({ type: 'text', value: text.slice(lastIndex) });
  }
  if (spans.length === 0) {
    spans.push({ type: 'text', value: text });
  }
  return spans;
}

/** A linha inicia um bloco reconhecido (heading/hr/list/blockquote)? */
function isBlockStart(line: string): boolean {
  return (
    line.startsWith('# ') ||
    line.startsWith('## ') ||
    line.trim() === '---' ||
    line.startsWith('- ') ||
    line.startsWith('> ')
  );
}

/**
 * Quebra o corpo de um termo em blocos de bloco (heading1/heading2/list/
 * blockquote/hr/paragraph), cada um já com os spans inline resolvidos.
 * Função pura, sem IO — 1:1 testável por construto.
 */
export function parseTermMarkdown(source: string): TermBlock[] {
  const lines = source.split('\n');
  const blocks: TermBlock[] = [];
  let i = 0;
  /** Acesso seguro (`noUncheckedIndexedAccess`) — `i` sempre é validado por `i < lines.length` antes do uso. */
  const at = (index: number): string => lines[index] ?? '';

  while (i < lines.length) {
    const line = at(i);

    if (line.trim() === '') {
      i++;
      continue;
    }

    if (line.startsWith('# ')) {
      blocks.push({ type: 'heading1', spans: parseInline(line.slice(2).trim()) });
      i++;
      continue;
    }

    if (line.startsWith('## ')) {
      blocks.push({ type: 'heading2', spans: parseInline(line.slice(3).trim()) });
      i++;
      continue;
    }

    if (line.trim() === '---') {
      blocks.push({ type: 'hr' });
      i++;
      continue;
    }

    if (line.startsWith('- ')) {
      const items: string[] = [];
      let current = line.slice(2).trim();
      i++;
      while (i < lines.length) {
        const next = at(i);
        if (next.trim() === '') break;
        if (next.startsWith('- ')) {
          items.push(current);
          current = next.slice(2).trim();
          i++;
          continue;
        }
        if (isBlockStart(next)) break;
        // Linha de continuação (quebra visual do mesmo item da lista).
        current = `${current} ${next.trim()}`;
        i++;
      }
      items.push(current);
      blocks.push({ type: 'list', items: items.map(parseInline) });
      continue;
    }

    if (line.startsWith('> ')) {
      const parts: string[] = [line.slice(2).trim()];
      i++;
      while (i < lines.length && at(i).startsWith('> ')) {
        parts.push(at(i).slice(2).trim());
        i++;
      }
      blocks.push({ type: 'blockquote', spans: parseInline(parts.join(' ')) });
      continue;
    }

    // Parágrafo: acumula linhas consecutivas até linha em branco ou início de bloco.
    const paraLines: string[] = [line.trim()];
    i++;
    while (i < lines.length && at(i).trim() !== '' && !isBlockStart(at(i))) {
      paraLines.push(at(i).trim());
      i++;
    }
    blocks.push({ type: 'paragraph', spans: parseInline(paraLines.join(' ')) });
  }

  return blocks;
}

/** Renderiza os spans inline de um bloco como filhos React (nunca HTML injetado). */
function renderSpans(spans: InlineSpan[], keyPrefix: string) {
  return spans.map((span, index) => {
    const key = `${keyPrefix}-${index}`;
    if (span.type === 'bold') return <strong key={key}>{span.value}</strong>;
    if (span.type === 'code') {
      return (
        <code key={key} className="rounded-sm bg-background px-1 py-0.5 text-[0.85em]">
          {span.value}
        </code>
      );
    }
    return <Fragment key={key}>{span.value}</Fragment>;
  });
}

export interface TermMarkdownProps {
  /** Corpo do termo já sem front-matter (ex.: `stripTermFrontMatter(term.content)`). */
  source: string;
  className?: string;
  'aria-label'?: string;
}

/**
 * Renderiza o corpo de um termo de consentimento formatado (AUTH6-1/2).
 * Substitui o despejo cru (`<div>{term.body}</div>`) nos 5 pontos de uso.
 */
export function TermMarkdown({ source, className, 'aria-label': ariaLabel }: TermMarkdownProps) {
  const blocks = parseTermMarkdown(source);

  return (
    <div className={cn(className)} aria-label={ariaLabel}>
      {blocks.map((block, index) => {
        const key = `block-${index}`;
        switch (block.type) {
          case 'heading1':
            return (
              <h1 key={key} className="mb-2 font-heading text-lg font-bold text-fg">
                {renderSpans(block.spans, key)}
              </h1>
            );
          case 'heading2':
            return (
              <h2 key={key} className="mb-1 mt-3 font-heading text-base font-semibold text-fg">
                {renderSpans(block.spans, key)}
              </h2>
            );
          case 'list':
            return (
              <ul key={key} className="mb-2 list-disc pl-5">
                {block.items.map((item, itemIndex) => (
                  <li key={`${key}-item-${itemIndex}`}>
                    {renderSpans(item, `${key}-item-${itemIndex}`)}
                  </li>
                ))}
              </ul>
            );
          case 'blockquote':
            return (
              <blockquote
                key={key}
                className="mb-2 border-l-2 border-border pl-3 italic text-fg-muted"
              >
                {renderSpans(block.spans, key)}
              </blockquote>
            );
          case 'hr':
            return <hr key={key} className="my-3 border-border" />;
          case 'paragraph':
          default:
            return (
              <p key={key} className="mb-2">
                {renderSpans(block.spans, key)}
              </p>
            );
        }
      })}
    </div>
  );
}
