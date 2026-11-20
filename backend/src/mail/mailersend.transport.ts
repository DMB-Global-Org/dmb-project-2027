import {
  MailError,
  type MailMessage,
  type MailTransport,
} from './mail.types.js';

export interface MailerSendOptions {
  apiKey: string;
  fromEmail: string;
  fromName: string;
  /** Injectable for tests. */
  fetch?: typeof fetch;
  baseUrl?: string;
}

/** MailerSend REST API (https://developers.mailersend.com/api/v1/email.html), no SDK. */
export class MailerSendTransport implements MailTransport {
  private readonly fetchFn: typeof fetch;
  private readonly baseUrl: string;

  constructor(private readonly options: MailerSendOptions) {
    this.fetchFn = options.fetch ?? fetch;
    this.baseUrl = options.baseUrl ?? 'https://api.mailersend.com';
  }

  async send(message: MailMessage): Promise<void> {
    let response: Response;
    try {
      response = await this.fetchFn(`${this.baseUrl}/v1/email`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.options.apiKey}`,
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: JSON.stringify({
          from: { email: this.options.fromEmail, name: this.options.fromName },
          to: [{ email: message.to }],
          subject: message.subject,
          text: message.text,
          html: message.html,
        }),
        signal: AbortSignal.timeout(15_000),
      });
    } catch (error) {
      // Network failure or timeout: worth another try.
      throw new MailError(`MailerSend unreachable: ${String(error)}`, false);
    }

    if (response.ok) return;

    const detail = (await response.text().catch(() => '')).slice(0, 500);
    // 4xx means the request itself is wrong (address, key, domain) and a retry
    // changes nothing; 429 (rate limit) and 5xx are temporary.
    const permanent =
      response.status >= 400 &&
      response.status < 500 &&
      response.status !== 429;
    throw new MailError(`MailerSend ${response.status}: ${detail}`, permanent);
  }
}
