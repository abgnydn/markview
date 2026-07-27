import { describe, it, expect } from 'vitest';
import {
  generateRoomId,
  generateRoomSecret,
  getShareUrl,
  getRoomSecretFromUrl,
} from '@/lib/collab/y-provider';

describe('collab room links', () => {
  it('room ids are mkv- + 12 uniform hex chars and unique', () => {
    const ids = new Set(Array.from({ length: 50 }, generateRoomId));
    expect(ids.size).toBe(50);
    for (const id of ids) expect(id).toMatch(/^mkv-[0-9a-f]{12}$/);
  });

  it('room secrets are url-safe base64 with 128 bits of entropy', () => {
    const s = generateRoomSecret();
    expect(s).toMatch(/^[A-Za-z0-9_-]{22}$/); // 16 bytes → 22 base64url chars
    expect(generateRoomSecret()).not.toBe(s);
  });

  it('share URL carries the secret in the fragment only', () => {
    const url = getShareUrl('mkv-aabbccddeeff', 'SECRET_123');
    expect(url).toContain('?room=mkv-aabbccddeeff');
    expect(url).toContain('#k=SECRET_123');
    // fragment comes after the query — servers never see it
    expect(url.indexOf('#k=')).toBeGreaterThan(url.indexOf('?room='));
  });

  it('secret round-trips through the URL fragment', () => {
    window.location.hash = '#k=abc_DEF-123';
    expect(getRoomSecretFromUrl()).toBe('abc_DEF-123');
    window.location.hash = '';
  });

  it('does not misread the #md= share-content hash as a room secret', () => {
    window.location.hash = '#md=eNoLycgsVgCAAxUBmg&title=Doc';
    expect(getRoomSecretFromUrl()).toBeNull();
    window.location.hash = '';
  });

  it('links without a secret still produce a plain room URL', () => {
    expect(getShareUrl('mkv-aabbccddeeff')).not.toContain('#');
  });
});
