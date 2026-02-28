import jwt from 'jsonwebtoken';
import { ensureAccount, isAccountDisabled } from './accounts';

export function verifyActiveUserToken(token: string, secret: string) {
  const payload: any = jwt.verify(token, secret);
  const userId = String(payload?.sub || '');
  if (!userId) {
    throw new Error('invalid token');
  }
  ensureAccount(userId);
  if (isAccountDisabled(userId)) {
    throw new Error('account disabled');
  }
  return payload;
}
