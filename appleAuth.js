import crypto from 'crypto';
import jwt from 'jsonwebtoken';

const APPLE_KEYS_URL = 'https://appleid.apple.com/auth/keys';
const APPLE_ISSUER = 'https://appleid.apple.com';
const JWKS_CACHE_TTL_MS = 60 * 60 * 1000;

let cachedKeys = null;
let cachedAt = 0;

async function fetchAppleKeys() {
  const now = Date.now();
  if (cachedKeys && now - cachedAt < JWKS_CACHE_TTL_MS) return cachedKeys;

  const response = await fetch(APPLE_KEYS_URL);
  if (!response.ok) throw new Error(`Failed to fetch Apple's signing keys (${response.status})`);

  const { keys } = await response.json();
  cachedKeys = keys;
  cachedAt = now;
  return keys;
}

function requireAudience() {
  if (!process.env.APPLE_BUNDLE_ID) {
    throw new Error("APPLE_BUNDLE_ID is not set. Add it to .env (your iOS app's bundle identifier).");
  }
  return process.env.APPLE_BUNDLE_ID;
}

/// Verifies a Sign in with Apple identity token: checks its signature against
/// Apple's published public keys, and its issuer/audience/expiry. Returns the
/// token's claims (notably `sub`, the stable per-user identifier, and `email`).
export async function verifyAppleIdentityToken(identityToken) {
  const audience = requireAudience();

  const decodedHeader = jwt.decode(identityToken, { complete: true })?.header;
  if (!decodedHeader?.kid) throw new Error('Malformed Apple identity token');

  const keys = await fetchAppleKeys();
  const jwk = keys.find((key) => key.kid === decodedHeader.kid);
  if (!jwk) throw new Error("Couldn't find a matching Apple signing key");

  const publicKey = crypto.createPublicKey({ key: jwk, format: 'jwk' });

  return jwt.verify(identityToken, publicKey, {
    algorithms: ['RS256'],
    issuer: APPLE_ISSUER,
    audience,
  });
}
