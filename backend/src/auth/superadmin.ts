import { eq } from 'drizzle-orm';
import type { Database } from '../db/database.tokens.js';
import { accounts } from '../db/schema/index.js';
import { checkPasswordStrength, hashPassword } from './password.js';

export type EnsureSuperAdminResult = 'created' | 'exists' | 'password_reset';

/**
 * Creates the SuperAdministrator account (it exists from the first start of
 * the app and has no Partner row). Idempotent: running it again changes
 * nothing unless `resetPassword` is set.
 */
export async function ensureSuperAdmin(
  db: Database,
  input: { email: string; password: string; resetPassword?: boolean },
): Promise<EnsureSuperAdminResult> {
  const email = input.email.trim().toLowerCase();
  if (!email.includes('@')) throw new Error('Invalid e-mail address');
  const problem = checkPasswordStrength(input.password);
  if (problem) throw new Error(`Password rejected: ${problem}`);

  const [existing] = await db
    .select()
    .from(accounts)
    .where(eq(accounts.email, email));

  if (!existing) {
    await db.insert(accounts).values({
      email,
      passwordHash: await hashPassword(input.password),
      isSuperAdmin: true,
    });
    return 'created';
  }
  if (!existing.isSuperAdmin) {
    throw new Error(`${email} already belongs to a Partner account`);
  }
  if (!input.resetPassword) return 'exists';

  await db
    .update(accounts)
    .set({ passwordHash: await hashPassword(input.password) })
    .where(eq(accounts.id, existing.id));
  return 'password_reset';
}
