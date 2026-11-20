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
          // Messages carry one-time links: MailerSend must not rewrite them
          // into tracking redirects (which would also route the secret
          // through its servers) nor track who opens or clicks.
          settings: {
            track_clicks: false,
            track_opens: false,
            track_content: false,
          },
        }),
        signal: AbortSignal.timeout(15_000),
      });
    } catch (error) {
      // Network failure or timeout: worth another try.
      throw new MailError(`MailerSend unreachable: ${String(error)}`, false);
    }

    if (response.ok) {
      // 202 without a message id means nothing was queued: every recipient is
      // suppressed (blocklisted, bounced, unsubscribed). Retrying is pointless.
      if (!response.headers.get('x-message-id')) {
        const detail = (await response.text().catch(() => '')).slice(0, 500);
        throw new MailError(
          `MailerSend accepted the request but queued nothing: ${detail}`,
          true,
        );
      }
      return;
    }

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
