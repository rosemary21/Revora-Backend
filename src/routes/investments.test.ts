import crypto from 'crypto';
import { Request, Response } from 'express';
import { Pool } from 'pg';
import { createInvestmentsRouter } from './investments';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SECRET = 'test-secret';

function makeToken(payload: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString(
    'base64url'
  );
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto
    .createHmac('sha256', SECRET)
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

function makeReq(
  authHeader?: string,
  query: Record<string, string> = {}
): Request {
  return {
    headers: authHeader ? { authorization: authHeader } : {},
    query,
  } as unknown as Request;
}

// ---------------------------------------------------------------------------
// Route: GET /
// ---------------------------------------------------------------------------

describe('GET /api/investments route handler', () => {
  let mockPool: jest.Mocked<Pool>;

  beforeEach(() => {
    process.env['JWT_SECRET'] = SECRET;
    mockPool = {
      query: jest.fn(),
    } as unknown as jest.Mocked<Pool>;
  });

  afterEach(() => {
    delete process.env['JWT_SECRET'];
  });

  it('should return 401 when no token is provided', async () => {
    const router = createInvestmentsRouter(mockPool);
    const layer = router.stack[0];
    const req = makeReq();
    const res = makeMockRes();
    const next = jest.fn();

    // Invoke the first middleware (requireInvestor) directly
    layer.handle(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('should return investments for an authenticated investor', async () => {
    const mockInvestments = [
      {
        id: 'inv-1',
        investor_id: 'investor-123',
        offering_id: 'offering-abc',
        amount: '5000.00',
        tokens: '50.000000',
        status: 'confirmed',
        created_at: new Date('2024-01-15'),
        updated_at: new Date('2024-01-15'),
      },
    ];

    mockPool.query.mockResolvedValueOnce({
      rows: mockInvestments,
      rowCount: 1,
      command: 'SELECT',
      oid: 0,
      fields: [],
    });

    const token = makeToken({ sub: 'investor-123', role: 'investor' });
    const router = createInvestmentsRouter(mockPool);

    // Build a minimal express-like dispatch: chain all layers
    const req = makeReq(`Bearer ${token}`);
    const res = makeMockRes();
    let nextCalled = false;

    // Simulate express dispatch through the route's middleware stack
    const layers = router.stack;
    let idx = 0;
    function next(): void {
      const layer = layers[idx++];
      if (!layer) {
        nextCalled = true;
        return;
      }
      layer.handle(req, res, next);
    }
    next();

    // Allow async middleware to resolve
    await new Promise(process.nextTick);

    expect(res.json).toHaveBeenCalledWith({ data: mockInvestments });
    expect(nextCalled).toBe(false);
  });

  it('should pass offering_id filter to the repository', async () => {
    mockPool.query.mockResolvedValueOnce({
      rows: [],
      rowCount: 0,
      command: 'SELECT',
      oid: 0,
      fields: [],
    });

    const token = makeToken({ sub: 'investor-123', role: 'investor' });
    const router = createInvestmentsRouter(mockPool);
    const req = makeReq(`Bearer ${token}`, { offering_id: 'offering-abc' });
    const res = makeMockRes();

    const layers = router.stack;
    let idx = 0;
    function next(): void {
      const layer = layers[idx++];
      if (layer) layer.handle(req, res, next);
    }
    next();

    await new Promise(process.nextTick);

    expect(mockPool.query).toHaveBeenCalledWith(
      expect.stringContaining('AND offering_id = $2'),
      expect.arrayContaining(['investor-123', 'offering-abc'])
    );
  });

  it('should return 400 for a non-numeric limit', async () => {
    const token = makeToken({ sub: 'investor-123', role: 'investor' });
    const router = createInvestmentsRouter(mockPool);
    const req = makeReq(`Bearer ${token}`, { limit: 'abc' });
    const res = makeMockRes();

    const layers = router.stack;
    let idx = 0;
    function next(): void {
      const layer = layers[idx++];
      if (layer) layer.handle(req, res, next);
    }
    next();

    await new Promise(process.nextTick);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid limit parameter' });
  });

  it('should return 400 for a negative offset', async () => {
    const token = makeToken({ sub: 'investor-123', role: 'investor' });
    const router = createInvestmentsRouter(mockPool);
    const req = makeReq(`Bearer ${token}`, { offset: '-5' });
    const res = makeMockRes();

    const layers = router.stack;
    let idx = 0;
    function next(): void {
      const layer = layers[idx++];
      if (layer) layer.handle(req, res, next);
    }
    next();

    await new Promise(process.nextTick);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid offset parameter' });
  });

  it('should return 500 when the repository throws', async () => {
    mockPool.query.mockRejectedValueOnce(new Error('db error'));

    const token = makeToken({ sub: 'investor-123', role: 'investor' });
    const router = createInvestmentsRouter(mockPool);
    const req = makeReq(`Bearer ${token}`);
    const res = makeMockRes();

    const layers = router.stack;
    let idx = 0;
    function next(): void {
      const layer = layers[idx++];
      if (layer) layer.handle(req, res, next);
    }
    next();

    await new Promise(process.nextTick);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Internal server error' });
  });
});
