import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

export interface AuthenticatedRequest extends Request {
  user: {
    sub: string;
    role: string;
  };
}

interface JwtPayload {
  sub: string;
  role: string;
  iat?: number;
  exp?: number;
}

/**
 * Verify a HS256 JWT using Node.js built-in crypto.
 * @throws Error if the token is malformed, has an invalid signature, or is expired.
 */
export function verifyJwt(token: string, secret: string): JwtPayload {
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error('Invalid token format');
  }

  const [headerB64, payloadB64, signatureB64] = parts;

  const expectedSig = crypto
    .createHmac('sha256', secret)
    .update(`${headerB64}.${payloadB64}`)
    .digest('base64url');

  if (expectedSig !== signatureB64) {
    throw new Error('Invalid token signature');
  }

  const payload: JwtPayload = JSON.parse(
    Buffer.from(payloadB64, 'base64url').toString('utf8')
  );

  if (payload.exp !== undefined && payload.exp < Math.floor(Date.now() / 1000)) {
    throw new Error('Token expired');
  }

  return payload;
}

/**
 * Express middleware that requires a valid JWT with role=investor.
 * Reads the Bearer token from the Authorization header and attaches
 * the decoded payload to req.user.
 */
export function requireInvestor(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid Authorization header' });
    return;
  }

  const token = authHeader.slice(7);
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    res.status(500).json({ error: 'Server configuration error' });
    return;
  }

  try {
    const payload = verifyJwt(token, secret);

    if (payload.role !== 'investor') {
      res.status(403).json({ error: 'Forbidden: investor role required' });
      return;
    }

    (req as AuthenticatedRequest).user = { sub: payload.sub, role: payload.role };
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}
