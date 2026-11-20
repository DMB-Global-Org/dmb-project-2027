import {
  createInvitationSchema,
  registerSchema,
} from './invitation.schemas.js';

const FORM = {
  token: 'abc',
  email: 'jan@example.com',
  password: 'correct horse battery',
  passwordConfirmation: 'correct horse battery',
  partnerNumber: '1234567',
};

describe('registerSchema', () => {
  it('defaults the country to PL and upper-cases a given one', () => {
    expect(registerSchema.parse(FORM).country).toBe('PL');
    expect(registerSchema.parse({ ...FORM, country: 'de' }).country).toBe('DE');
  });

  it('normalizes the e-mail address', () => {
    expect(
      registerSchema.parse({ ...FORM, email: '  Jan@Example.COM ' }).email,
    ).toBe('jan@example.com');
  });

  it('makes equal numbers equal: whitespace is dropped', () => {
    expect(
      registerSchema.parse({ ...FORM, partnerNumber: ' 123 456 789 0 ' })
        .partnerNumber,
    ).toBe('1234567890');
  });

  it.each(['123456', '1234567890', '123456789012'])(
    'accepts the partner number %j',
    (partnerNumber) => {
      expect(registerSchema.safeParse({ ...FORM, partnerNumber }).success).toBe(
        true,
      );
    },
  );

  it.each([
    '',
    '12345',
    '1234567890123',
    '12-3456789',
    'AB1234567',
    '12.345678',
  ])('rejects the partner number %j', (partnerNumber) => {
    const result = registerSchema.safeParse({ ...FORM, partnerNumber });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(['partnerNumber']);
  });

  it('rejects a confirmation that differs from the password', () => {
    const result = registerSchema.safeParse({
      ...FORM,
      passwordConfirmation: 'something else',
    });
    expect(result.error?.issues[0]?.path).toEqual(['passwordConfirmation']);
  });

  it.each(['PLL', 'P', '1A', ''])('rejects the country %j', (country) => {
    expect(registerSchema.safeParse({ ...FORM, country }).success).toBe(false);
  });

  it('rejects a malformed e-mail address', () => {
    expect(
      registerSchema.safeParse({ ...FORM, email: 'not-an-email' }).success,
    ).toBe(false);
  });
});

describe('explicit nulls from GraphQL', () => {
  it('count as omitted fields', () => {
    expect(registerSchema.parse({ ...FORM, country: null }).country).toBe('PL');
    const parsed = createInvitationSchema.parse({
      kind: 'PARTNER',
      recipientEmail: 'a@b.pl',
      recipientPhone: null,
      recommenderId: null,
      locale: null,
      sendEmail: null,
    });
    expect(parsed).toMatchObject({ locale: 'pl', sendEmail: false });
  });
});

describe('createInvitationSchema', () => {
  it('sends e-mail only to an address it has', () => {
    expect(
      createInvitationSchema.safeParse({
        kind: 'PARTNER',
        recipientPhone: '+48 600 100 200',
        sendEmail: true,
      }).success,
    ).toBe(false);
    expect(
      createInvitationSchema.safeParse({
        kind: 'PARTNER',
        recipientEmail: 'a@b.pl',
        sendEmail: true,
      }).success,
    ).toBe(true);
  });

  it('needs an e-mail address or a phone number', () => {
    expect(createInvitationSchema.safeParse({ kind: 'PARTNER' }).success).toBe(
      false,
    );
    expect(
      createInvitationSchema.safeParse({
        kind: 'PARTNER',
        recipientPhone: '+48 600 100 200',
      }).success,
    ).toBe(true);
    expect(
      createInvitationSchema.safeParse({
        kind: 'PARTNER',
        recipientEmail: 'A@B.pl',
      }).data?.recipientEmail,
    ).toBe('a@b.pl');
  });

  it('defaults the language to Polish and accepts only supported ones', () => {
    const base = { kind: 'PARTNER', recipientEmail: 'a@b.pl' };
    expect(createInvitationSchema.parse(base).locale).toBe('pl');
    expect(
      createInvitationSchema.safeParse({ ...base, locale: 'fr' }).success,
    ).toBe(false);
  });

  it.each(['abc', '12', '+48 600; drop', ''])(
    'rejects the phone %j',
    (recipientPhone) => {
      expect(
        createInvitationSchema.safeParse({ kind: 'PARTNER', recipientPhone })
          .success,
      ).toBe(false);
    },
  );
});
