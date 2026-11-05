const issuer = process.env.BETTER_AUTH_URL || 'http://localhost:3000';
const audience = process.env.JWT_AUDIENCE || 'booknook-api';
const jwksUrl = process.env.AUTH_JWKS_URL || `${issuer.replace(/\/$/, '')}/api/auth/jwks`;
const josePromise = import('jose').then(({ createRemoteJWKSet, jwtVerify }) => ({
  jwtVerify,
  remoteJwks: createRemoteJWKSet(new URL(jwksUrl)),
}));

const invalidTokenCodes = new Set([
  'ERR_JWS_INVALID',
  'ERR_JWT_CLAIM_VALIDATION_FAILED',
  'ERR_JWT_EXPIRED',
  'ERR_JWT_INVALID',
  'ERR_JWKS_NO_MATCHING_KEY',
  'ERR_JWS_SIGNATURE_VERIFICATION_FAILED',
]);

async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';

  if (!token) {
    return res.status(401).json({ message: 'Sign in to continue.' });
  }

  try {
    const { jwtVerify, remoteJwks } = await josePromise;
    const { payload } = await jwtVerify(token, remoteJwks, {
      issuer,
      audience,
    });
    if (typeof payload.sub !== 'string' || typeof payload.email !== 'string') {
      return res.status(401).json({ message: 'Your session token is missing required account details.' });
    }

    req.user = {
      id: payload.sub,
      email: payload.email.toLowerCase(),
      name: typeof payload.name === 'string' ? payload.name : '',
    };
    return next();
  } catch (error) {
    if (invalidTokenCodes.has(error.code)) {
      return res.status(401).json({ message: 'Your session has expired. Please sign in again.' });
    }
    return next(Object.assign(new Error('Authentication service is temporarily unavailable.'), { status: 503 }));
  }
}

module.exports = requireAuth;
