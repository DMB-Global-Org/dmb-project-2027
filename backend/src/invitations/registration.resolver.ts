import { Args, Context, Mutation, Resolver } from '@nestjs/graphql';
import { checkPasswordStrength } from '../auth/password.js';
import type { GqlContext } from '../auth/auth.types.js';
import { requestMeta } from '../auth/cookies.js';
import { Public } from '../auth/public.decorator.js';
import { SessionCookie } from '../auth/session-cookie.js';
import { Viewer } from '../auth/viewer.model.js';
import { appError } from '../common/graphql-error.js';
import { RegisterInput } from './invitation.models.js';
import { firstInvalidField, registerSchema } from './invitation.schemas.js';
import { RegistrationService } from './registration.service.js';

@Resolver(() => Viewer)
export class RegistrationResolver {
  constructor(
    private readonly registration: RegistrationService,
    private readonly cookie: SessionCookie,
  ) {}

  /** Saves the account behind a registration link and logs it in. */
  @Public()
  @Mutation(() => Viewer)
  async register(
    @Args('input') input: RegisterInput,
    @Context() ctx: GqlContext,
  ): Promise<Viewer> {
    const parsed = registerSchema.safeParse(input);
    if (!parsed.success) {
      throw appError('VALIDATION_FAILED', {
        field: firstInvalidField(parsed.error),
      });
    }
    const { token, password, ...form } = parsed.data;
    const weakness = checkPasswordStrength(password);
    if (weakness) {
      throw appError('VALIDATION_FAILED', {
        field: 'password',
        reason: weakness,
      });
    }

    const result = await this.registration.register(
      token,
      {
        email: form.email,
        password,
        country: form.country,
        partnerNumber: form.partnerNumber,
      },
      requestMeta(ctx.req),
    );
    this.cookie.set(ctx.res, result.token, result.expiresAt);
    return Viewer.from(result.auth);
  }
}
