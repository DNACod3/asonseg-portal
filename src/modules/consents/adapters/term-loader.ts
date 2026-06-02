import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { ConsentPurpose } from '../domain/purposes';
import { PURPOSE_METADATA } from '../domain/purposes';
import {
  TERMS_REGISTRY,
  currentTermVersion,
  normalizeTermVersion,
} from '../domain/terms-registry';

/**
 * Leitor de termos versionados (adapter de IO — server-only). Carrega o arquivo
 * da finalidade em `legal/consent-terms/<slug>/<version>.md`, calcula o SHA-256
 * do conteúdo íntegro e valida contra o hash esperado do registro (LGP-02 / #35).
 *
 * Falhas são erros de configuração/integridade (nunca silenciosas):
 *  - arquivo ausente            → {@link TermLoaderError} code `TERM_NOT_FOUND`;
 *  - hash diverge do registro   → {@link TermLoaderError} code `TERM_HASH_MISMATCH`.
 *
 * Os termos vivem no Git, fora do app — não há editor via UI (P-009 / README dos termos).
 */

/** Diretório raiz dos termos versionados (relativo à raiz do projeto). */
const TERMS_DIR = path.join(process.cwd(), 'legal', 'consent-terms');

export type TermLoaderErrorCode = 'TERM_NOT_FOUND' | 'TERM_HASH_MISMATCH';

/** Erro de configuração/integridade do termo — bloqueia o aceite. */
export class TermLoaderError extends Error {
  readonly code: TermLoaderErrorCode;
  constructor(code: TermLoaderErrorCode, message: string) {
    super(message);
    this.name = 'TermLoaderError';
    this.code = code;
  }
}

/** Termo carregado e validado, pronto para exibição/registro do aceite. */
export interface LoadedTerm {
  readonly purpose: ConsentPurpose;
  /** Versão no formato de arquivo (`v1.0`). */
  readonly version: string;
  /** Conteúdo íntegro do termo (markdown, inclui o front-matter). */
  readonly content: string;
  /** SHA-256 (hex) recalculado do conteúdo — registrado no aceite (prova LGPD). */
  readonly hash: string;
  /** Data de vigência declarada no front-matter (`effective_date`), se houver. */
  readonly effectiveDate: string | null;
  /** Base legal declarada no front-matter (`legal_basis`), se houver. */
  readonly legalBasis: string | null;
  /** Status de revisão jurídica (`aprovado` | `aguardando-revisao-juridica`). */
  readonly status: string | null;
}

/** Metadados parseados do front-matter YAML simples do termo. */
type FrontMatter = Record<string, string>;

function parseFrontMatter(content: string): FrontMatter {
  const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(content);
  if (!match || match[1] === undefined) return {};
  const block = match[1];
  const out: FrontMatter = {};
  for (const rawLine of block.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const sep = line.indexOf(':');
    if (sep === -1) continue;
    const key = line.slice(0, sep).trim();
    const value = line
      .slice(sep + 1)
      .trim()
      .replace(/^["']|["']$/g, '');
    if (key) out[key] = value;
  }
  return out;
}

/** Caminho absoluto do arquivo do termo de uma finalidade/versão. */
function termFilePath(purpose: ConsentPurpose, fileVersion: string): string {
  return path.join(TERMS_DIR, PURPOSE_METADATA[purpose].slug, `${fileVersion}.md`);
}

/**
 * Carrega e valida o termo de uma finalidade.
 *
 * @param purpose  Finalidade do consentimento.
 * @param version  Versão a carregar (default: vigente). Aceita o formato de
 *                 arquivo (`v1.0`) ou o legado (`job-application@v1.0`).
 *                 A validação de hash contra o registro só ocorre para a versão
 *                 vigente (versões antigas são carregadas para exibição histórica).
 */
export async function loadTerm(
  purpose: ConsentPurpose,
  version?: string,
): Promise<LoadedTerm> {
  const fileVersion = normalizeTermVersion(version ?? currentTermVersion(purpose));
  // Defesa de path traversal: `purpose` é enum-constrained, mas a versão pode vir
  // de dado persistido — só aceitamos o formato canônico `vN.M` (nada que escape
  // o diretório de termos).
  if (!/^v\d+\.\d+$/.test(fileVersion)) {
    throw new TermLoaderError(
      'TERM_NOT_FOUND',
      `Versão de termo inválida para ${purpose}: "${version ?? fileVersion}".`,
    );
  }
  const filePath = termFilePath(purpose, fileVersion);

  let buffer: Buffer;
  try {
    buffer = await readFile(filePath);
  } catch {
    throw new TermLoaderError(
      'TERM_NOT_FOUND',
      `Termo da finalidade ${purpose} (${fileVersion}) não encontrado em ${filePath}.`,
    );
  }

  const hash = createHash('sha256').update(buffer).digest('hex');
  const isCurrent = fileVersion === currentTermVersion(purpose);
  if (isCurrent && hash !== TERMS_REGISTRY[purpose].expectedHash) {
    throw new TermLoaderError(
      'TERM_HASH_MISMATCH',
      `Integridade do termo ${purpose} (${fileVersion}) comprometida: ` +
        `hash ${hash} difere do registro ${TERMS_REGISTRY[purpose].expectedHash}.`,
    );
  }

  const content = buffer.toString('utf8');
  const fm = parseFrontMatter(content);

  return {
    purpose,
    version: fileVersion,
    content,
    hash,
    effectiveDate: fm.effective_date ?? null,
    legalBasis: fm.legal_basis ?? null,
    status: fm.status ?? null,
  };
}
