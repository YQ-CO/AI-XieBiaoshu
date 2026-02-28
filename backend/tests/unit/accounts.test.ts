import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { ensureAccount, isAccountDisabled, loadAccounts, setAccountDisabled, touchLastLogin } from '../../src/lib/accounts';
import { restoreData, seedTestData, snapshotData } from '../helpers/dataSandbox';

describe('accounts lib', () => {
  const snapshot = snapshotData();

  beforeEach(() => {
    seedTestData();
  });

  afterAll(() => {
    restoreData(snapshot);
  });

  it('creates account when missing', () => {
    const account = ensureAccount('u-1');
    expect(account.id).toBe('u-1');
    expect(loadAccounts().some((item) => item.id === 'u-1')).toBe(true);
  });

  it('updates last login timestamp', () => {
    touchLastLogin('u-2');
    const account = loadAccounts().find((item) => item.id === 'u-2');
    expect(account?.lastLoginAt).toBeTruthy();
  });

  it('toggles disabled state', () => {
    setAccountDisabled('u-3', true, 'abuse');
    expect(isAccountDisabled('u-3')).toBe(true);

    setAccountDisabled('u-3', false);
    expect(isAccountDisabled('u-3')).toBe(false);
  });
});
