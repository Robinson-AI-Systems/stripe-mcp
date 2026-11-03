import { describe, it, expect, beforeEach } from 'vitest';
import {
  resolveCimdClient, isCimdClientId, isPublicAddress, clearCimdCache,
  CIMD_MAX_BYTES
} from '../../src/core/cimd.js';

const CARD_URL = 'https://cards.example.test/claude-client.json';
const PUBLIC_IP = '93.184.216.34';
const publicLookup = async () => [PUBLIC_IP];

function card(overrides = {}) {
  return {
    client_id: CARD_URL,
    client_name: 'Card Client',
    redirect_uris: ['https://client.example.test/cb'],
    token_endpoint_auth_method: 'none',
    grant_types: ['authorization_code', 'refresh_token'],
    response_types: ['code'],
    ...overrides
  };
}
function fetchDoc(doc, { status = 200, headers = {} } = {}) {
  const text = typeof doc === 'string' ? doc : JSON.stringify(doc);
  return async () => ({
    ok: status >= 200 && status < 300, status,
    headers: { get: (name) => headers[name.toLowerCase()] ?? null },
    text: async () => text
  });
}

describe('CIMD card resolution', () => {
  beforeEach(() => clearCimdCache());

  it('accepts a valid public card and normalizes it to a public client record', async () => {
    const client = await resolveCimdClient(CARD_URL, {
      fetchImpl: fetchDoc(card()), lookupImpl: publicLookup
    });
    expect(client).toMatchObject({
      client_id: CARD_URL, client_name: 'Card Client',
      token_endpoint_auth_method: 'none', client_secret_hash: null,
      redirect_uris: ['https://client.example.test/cb'], cimd: true
    });
  });

  it('treats only HTTPS URLs as card client IDs', () => {
    expect(isCimdClientId(CARD_URL)).toBe(true);
    expect(isCimdClientId('http://cards.example.test/x.json')).toBe(false);
    expect(isCimdClientId('plain-registered-id')).toBe(false);
    expect(isCimdClientId('https://user:pass@cards.example.test/x.json')).toBe(false);
    expect(isCimdClientId(42)).toBe(false);
  });

  it('refuses a card whose declared address differs from the fetched URL', async () => {
    const client = await resolveCimdClient(CARD_URL, {
      fetchImpl: fetchDoc(card({ client_id: 'https://cards.example.test/other.json' })),
      lookupImpl: publicLookup
    });
    expect(client).toBeNull();
  });

  it('refuses a card with no client name', async () => {
    const doc = card(); delete doc.client_name;
    const client = await resolveCimdClient(CARD_URL, {
      fetchImpl: fetchDoc(doc), lookupImpl: publicLookup
    });
    expect(client).toBeNull();
  });

  it('refuses secret-holding and confidential-method cards', async () => {
    for (const doc of [
      card({ client_secret: 'cs_FAKE_secret_value' }),
      card({ client_secret_expires_at: 0 }),
      card({ token_endpoint_auth_method: 'client_secret_basic' }),
      card({ token_endpoint_auth_method: 'private_key_jwt' })
    ]) {
      clearCimdCache();
      const client = await resolveCimdClient(CARD_URL, {
        fetchImpl: fetchDoc(doc), lookupImpl: publicLookup
      });
      expect(client).toBeNull();
    }
  });

  it('refuses cards with missing, invalid or duplicate redirect addresses', async () => {
    for (const redirect_uris of [
      [], ['http://evil.example.test/cb'], ['https://client.example.test/cb', 'https://client.example.test/cb'],
      'https://client.example.test/cb'
    ]) {
      clearCimdCache();
      const client = await resolveCimdClient(CARD_URL, {
        fetchImpl: fetchDoc(card({ redirect_uris })), lookupImpl: publicLookup
      });
      expect(client).toBeNull();
    }
  });

  it('refuses a card host that resolves to a private address (SSRF)', async () => {
    const client = await resolveCimdClient(CARD_URL, {
      fetchImpl: fetchDoc(card()), lookupImpl: async () => ['10.0.0.8']
    });
    expect(client).toBeNull();
  });

  it('refuses a card host with any private address among public answers', async () => {
    const client = await resolveCimdClient(CARD_URL, {
      fetchImpl: fetchDoc(card()), lookupImpl: async () => [PUBLIC_IP, '169.254.169.254']
    });
    expect(client).toBeNull();
  });

  it('refuses a card URL that is itself a private IP literal and never fetches it', async () => {
    let fetched = false;
    const client = await resolveCimdClient('https://192.168.1.20/card.json', {
      fetchImpl: async () => { fetched = true; throw new Error('must not fetch'); },
      lookupImpl: publicLookup
    });
    expect(client).toBeNull();
    expect(fetched).toBe(false);
  });

  it('refuses when DNS fails or returns nothing (unknown card host)', async () => {
    for (const lookupImpl of [async () => { throw new Error('ENOTFOUND'); }, async () => []]) {
      clearCimdCache();
      const client = await resolveCimdClient(CARD_URL, {
        fetchImpl: fetchDoc(card()), lookupImpl
      });
      expect(client).toBeNull();
    }
  });

  it('refuses oversized cards by declared length and by actual body', async () => {
    const big = 'x'.repeat(CIMD_MAX_BYTES + 1);
    let client = await resolveCimdClient(CARD_URL, {
      fetchImpl: fetchDoc(card(), { headers: { 'content-length': String(CIMD_MAX_BYTES + 1) } }),
      lookupImpl: publicLookup
    });
    expect(client).toBeNull();
    clearCimdCache();
    client = await resolveCimdClient(CARD_URL, {
      fetchImpl: fetchDoc(big), lookupImpl: publicLookup
    });
    expect(client).toBeNull();
  });

  it('refuses slow or failing fetches and non-JSON bodies', async () => {
    for (const fetchImpl of [
      async () => { throw new Error('timeout'); },
      fetchDoc(card(), { status: 404 }),
      fetchDoc('not json at all')
    ]) {
      clearCimdCache();
      const client = await resolveCimdClient(CARD_URL, {
        fetchImpl, lookupImpl: publicLookup
      });
      expect(client).toBeNull();
    }
  });

  it('follows a same-host redirect and still requires the card to name the original URL', async () => {
    const seen = [];
    const fetchImpl = async (url) => {
      seen.push(url);
      if (seen.length === 1) {
        return { ok: false, status: 302,
          headers: { get: (n) => n === 'location' ? '/moved/client.json' : null },
          text: async () => '' };
      }
      return fetchDoc(card())();
    };
    const client = await resolveCimdClient(CARD_URL, { fetchImpl, lookupImpl: publicLookup });
    expect(client?.client_id).toBe(CARD_URL);
    expect(seen).toEqual([CARD_URL, 'https://cards.example.test/moved/client.json']);
  });

  it('refuses a redirect to a different host and refuses redirect loops', async () => {
    const crossHost = async () => ({ ok: false, status: 302,
      headers: { get: (n) => n === 'location' ? 'https://other.example.test/card.json' : null },
      text: async () => '' });
    expect(await resolveCimdClient(CARD_URL, {
      fetchImpl: crossHost, lookupImpl: publicLookup
    })).toBeNull();
    clearCimdCache();
    const loop = async () => ({ ok: false, status: 302,
      headers: { get: (n) => n === 'location' ? '/again.json' : null },
      text: async () => '' });
    expect(await resolveCimdClient(CARD_URL, {
      fetchImpl: loop, lookupImpl: publicLookup
    })).toBeNull();
  });

  it('classifies special-use addresses as non-public', () => {
    for (const ip of ['10.1.2.3', '127.0.0.1', '169.254.169.254', '172.16.0.5',
      '192.168.0.1', '100.64.0.1', '192.0.2.10', '198.51.100.7', '203.0.113.9',
      '224.0.0.1', '0.0.0.0', '::1', 'fe80::1', 'fd00::1', 'ff02::1',
      '::ffff:10.0.0.1', '2001:db8::1']) {
      expect(isPublicAddress(ip), ip).toBe(false);
    }
    for (const ip of [PUBLIC_IP, '8.8.8.8', '2606:4700:4700::1111', '::ffff:8.8.8.8']) {
      expect(isPublicAddress(ip), ip).toBe(true);
    }
  });
});
