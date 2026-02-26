import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { verifyJwt, requireInvestor, AuthenticatedRequest } from './auth';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SECRET = 'test-secret';

function makeToken(
  payload: Record<string, unknown>,
  secret: string = SECRET
): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString(
    'base64url'
  );
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto
    .createHmac('sha256', secret)
    .update(`${header}.${body}`)
    .digest('base64url');
  return `${header}.${body}.${sig}`;
}

function makeMockRes(): jest.Mocked<Response> {
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  } as unknown as jest.Mocked<Response>;
  return res;
}

// ---------------------------------------------------------------------------
// verifyJwt
// ---------------------------------------------------------------------------

describe('verifyJwt', () => {
  it('should decode a valid token', () => {
    const token = makeToken({ sub: 'user-1', role: 'investor' });
    const payload = verifyJwt(token, SECRET);
    expect(payload.sub).toBe('user-1');
    expect(payload.role).toBe('investor');
  });

  it('should throw on a malformed token', () => {
    expect(() => verifyJwt('not.a.valid.token', SECRET)).toThrow(
      'Invalid token format'
    );
  });

  it('should throw on wrong secret', () => {
    const token = makeToken({ sub: 'user-1', role: 'investor' });
    expect(() => verifyJwt(token, 'wrong-secret')).toThrow(
      'Invalid token signature'
    );
  });

  it('should throw on an expired token', () => {
    const pastExp = Math.floor(Date.now() / 1000) - 60;
    const token = makeToken({ sub: 'user-1', role: 'investor', exp: pastExp });
    expect(() => verifyJwt(token, SECRET)).toThrow('Token expired');
  });

  it('should accept a token with a future expiry', () => {
    const futureExp = Math.floor(Date.now() / 1000) + 3600;
    const token = makeToken({ sub: 'user-1', role: 'investor', exp: futureExp });
    const payload = verifyJwt(token, SECRET);
    expect(payload.sub).toBe('user-1');
  });
});

// ---------------------------------------------------------------------------
// requireInvestor middleware
// ---------------------------------------------------------------------------

describe('requireInvestor', () => {
  const originalSecret = process.env['JWT_SECRET'];

  beforeEach(() => {
    process.env['JWT_SECRET'] = SECRET;
  });

  afterEach(() => {
    if (originalSecret === undefined) {
      delete process.env['JWT_SECRET'];
    } else {
      process.env['JWT_SECRET'] = originalSecret;
    }
  });

  function makeReq(authHeader?: string): Request {
    return {
      headers: authHeader ? { authorization: authHeader } : {},
    } as unknown as Request;
  }

  it('should call next() for a valid investor token', () => {
    const token = makeToken({ sub: 'investor-1', role: 'investor' });
    const req = makeReq(`Bearer ${token}`);
    const res = makeMockRes();
    const next: NextFunction = jest.fn();

    requireInvestor(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect((req as AuthenticatedRequest).user).toEqual({
      id: 'investor-1',
      role: 'investor',
    });
  });

  it('should return 401 when Authorization header is missing', () => {
    const req = makeReq();
    const res = makeMockRes();
    const next: NextFunction = jest.fn();

    requireInvestor(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 401 when Authorization header does not start with Bearer', () => {
    const req = makeReq('Basic some-credentials');
    const res = makeMockRes();
    const next: NextFunction = jest.fn();

    requireInvestor(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 401 for an invalid token', () => {
    const req = makeReq('Bearer invalid.token.here');
    const res = makeMockRes();
    const next: NextFunction = jest.fn();

    requireInvestor(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 403 for a non-investor role', () => {
    const token = makeToken({ sub: 'admin-1', role: 'admin' });
    const req = makeReq(`Bearer ${token}`);
    const res = makeMockRes();
    const next: NextFunction = jest.fn();

    requireInvestor(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 500 when JWT_SECRET is not set', () => {
    delete process.env['JWT_SECRET'];
    const token = makeToken({ sub: 'investor-1', role: 'investor' });
    const req = makeReq(`Bearer ${token}`);
    const res = makeMockRes();
    const next: NextFunction = jest.fn();

    requireInvestor(req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(next).not.toHaveBeenCalled();
  });
});
