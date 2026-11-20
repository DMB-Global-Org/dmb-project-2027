import { MailError } from './mail.types.js';
import { MailerSendTransport } from './mailersend.transport.js';

const MESSAGE = {
  to: 'jan@example.com',
  subject: 'Hello',
  text: 'plain',
  html: '<p>html</p>',
};

function transportWith(fetchFn: typeof fetch) {
  return new MailerSendTransport({
    apiKey: 'secret-key',
    fromEmail: 'no-reply@example.com',
    fromName: 'dMb',
    fetch: fetchFn,
    baseUrl: 'https://mailersend.test',
  });
}

const respond = (status: number, body = '') =>
  vi.fn<typeof fetch>().mockResolvedValue(new Response(body, { status }));

async function failureOf(fetchFn: typeof fetch): Promise<MailError> {
  try {
    await transportWith(fetchFn).send(MESSAGE);
  } catch (error) {
    if (error instanceof MailError) return error;
    throw error;
  }
  throw new Error('Expected the send to fail');
}

describe('MailerSendTransport', () => {
  it('posts the message with the API key', async () => {
    const fetchFn = respond(202);

    await transportWith(fetchFn).send(MESSAGE);

    const [url, init] = fetchFn.mock.calls[0]!;
    expect(url).toBe('https://mailersend.test/v1/email');
    expect(init!.method).toBe('POST');
    expect((init!.headers as Record<string, string>).Authorization).toBe(
      'Bearer secret-key',
    );
    expect(JSON.parse(init!.body as string)).toEqual({
      from: { email: 'no-reply@example.com', name: 'dMb' },
      to: [{ email: 'jan@example.com' }],
      subject: 'Hello',
      text: 'plain',
      html: '<p>html</p>',
    });
  });

  it.each([400, 401, 403, 422])(
    'gives up at once on %i: retrying cannot help',
    async (status) => {
      const error = await failureOf(respond(status, '{"message":"nope"}'));
      expect(error.permanent).toBe(true);
      expect(error.message).toContain(String(status));
    },
  );

  it.each([429, 500, 502, 503])(
    'tries again later after %i',
    async (status) => {
      expect((await failureOf(respond(status))).permanent).toBe(false);
    },
  );

  it('tries again later when the network fails', async () => {
    const fetchFn = vi
      .fn<typeof fetch>()
      .mockRejectedValue(new Error('ECONNRESET'));

    const error = await failureOf(fetchFn);

    expect(error.permanent).toBe(false);
    expect(error.message).toContain('ECONNRESET');
  });

  it('does not put the API key into the error', async () => {
    const error = await failureOf(respond(401, 'bad token'));
    expect(error.message).not.toContain('secret-key');
  });
});
