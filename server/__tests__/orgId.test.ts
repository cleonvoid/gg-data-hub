import { describe, it, expect } from 'vitest';
import { deriveOrgId } from '../middleware/requireAuth.js';

describe('deriveOrgId', () => {
  it('gives two different Gmail UIDs different orgs', () => {
    const org1 = deriveOrgId('uid_123', 'alice@gmail.com');
    const org2 = deriveOrgId('uid_456', 'bob@gmail.com');
    expect(org1).not.toBe(org2);
    expect(org1).toBe('org_user_uid_123');
    expect(org2).toBe('org_user_uid_456');
  });

  it('gives the same UID a stable org', () => {
    const orgA = deriveOrgId('uid_same', 'test@gmail.com');
    const orgB = deriveOrgId('uid_same', 'test@gmail.com');
    expect(orgA).toBe(orgB);
  });

  it('maps a corporate domain to a shared org_<domain> regardless of UID', () => {
    const org1 = deriveOrgId('uid_alice', 'alice@acme-corp.vn');
    const org2 = deriveOrgId('uid_bob', 'bob@acme-corp.vn');
    expect(org1).toBe(org2);
    expect(org1).toBe('org_acme_corp_vn');
  });

  it('handles a missing email gracefully', () => {
    const org = deriveOrgId('uid_anonymous', undefined);
    expect(org).toBe('org_user_uid_anonymous');
  });

  it('handles googlemail.com as personal account', () => {
    const org = deriveOrgId('uid_googlemail', 'user@googlemail.com');
    expect(org).toBe('org_user_uid_googlemail');
  });
});
