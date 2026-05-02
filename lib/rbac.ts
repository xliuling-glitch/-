import { getSession } from './auth';

export function requireRoles(roles: string[]) {
  const session = getSession();
  if (!session || !roles.includes(session.role)) throw new Error('FORBIDDEN');
  return session;
}
