import { createToken } from '@/shared/container';

/**
 * Infra de e-mail transacional (IDN-12). Porta + tipos compartilhados por
 * USP-001 (boas-vindas), USP-003 e USP-005 (redefinição de senha).
 *
 * Os consumidores dependem **apenas** desta interface (DI via `container.ts`),
 * nunca do SDK do provedor — mesmo princípio port→adapter do `CVExtractor`
 * (ADR-0012). Trocar Resend por outro provedor não toca o código de domínio.
 */

/** E-mail renderizado, pronto para o provedor: assunto + corpo HTML + texto. */
export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

/** Dados do template de boas-vindas (USP-001 / USP-003). */
export interface WelcomeEmailData {
  nome: string;
  /**
   * Rótulo do papel escolhido no cadastro (ex.: "candidato(a)"). Opcional:
   * quando presente, o e-mail menciona o papel e o próximo passo (aceite da
   * finalidade — E-002). Ausente em cadastros sem papel público.
   */
  papel?: string;
}

/** Dados do template de redefinição de senha (USP-005). */
export interface PasswordResetEmailData {
  nome: string;
  /** URL absoluta da página de redefinição, com o token embutido. */
  resetUrl: string;
  /** Validade do link em horas (exibida no corpo do e-mail). */
  expiraEmHoras: number;
}

/** Dados do template de boas-vindas pós-reivindicação de credencial (USP-003). */
export interface CredentialClaimWelcomeEmailData {
  nome: string;
  /** URL absoluta da página de definição de senha, com o token embutido. */
  setPasswordUrl: string;
  /** Validade do link em horas (exibida no corpo do e-mail). */
  expiraEmHoras: number;
}

/**
 * Mensagem a enviar, discriminada por `template`. O adapter escolhe o renderer
 * correspondente — o consumidor nunca monta HTML nem conhece o provedor.
 */
export type EmailMessage =
  | { to: string; template: 'welcome'; data: WelcomeEmailData }
  | { to: string; template: 'password-reset'; data: PasswordResetEmailData }
  | { to: string; template: 'credential-claim-welcome'; data: CredentialClaimWelcomeEmailData };

/** Resultado do envio. `id` é o identificador do provedor quando disponível. */
export interface EmailSendResult {
  readonly ok: boolean;
  readonly id?: string;
}

/**
 * Porta de envio de e-mail transacional. Nunca lança: falha de provedor vira
 * `{ ok: false }` (o caller decide como reagir — em USP-005, sem revelar nada
 * ao usuário, por anti-enumeração).
 */
export interface EmailSender {
  send(message: EmailMessage): Promise<EmailSendResult>;
}

export const EMAIL_SENDER_TOKEN = createToken<EmailSender>('EmailSender');
