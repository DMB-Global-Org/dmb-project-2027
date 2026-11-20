export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
}

/** Thrown by a transport. `permanent` errors (bad address, bad key) are not retried. */
export class MailError extends Error {
  constructor(
    message: string,
    readonly permanent: boolean,
  ) {
    super(message);
    this.name = 'MailError';
  }
}

export interface MailTransport {
  send(message: MailMessage): Promise<void>;
}

/** Injection token of the active transport (chosen by MAIL_DRIVER). */
export const MAIL_TRANSPORT = Symbol('MAIL_TRANSPORT');
