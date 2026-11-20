import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC = 'isPublic';

/**
 * Marks a resolver as callable without logging in. Every other resolver is
 * protected by the global AuthGuard, so forgetting this decorator fails closed.
 */
export const Public = () => SetMetadata(IS_PUBLIC, true);
