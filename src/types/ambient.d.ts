/**
 * Ambient type declarations for packages not listed in package.json.
 * Covers: Node.js built-ins (crypto, Buffer, process, setImmediate),
 * pg (Pool, QueryResult), and Jest globals (describe/it/expect/jest.*).
 *
 * These declarations are intentionally minimal — they expose only the API
 * surface used by this project.  Replace with proper @types/* packages once
 * the dev-dependency list is updated.
 */

// ─── crypto (Node.js built-in) ───────────────────────────────────────────────

declare module 'crypto' {
  interface Hmac {
    update(data: string): this;
    digest(encoding: string): string;
  }

  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace crypto {
    function createHmac(algorithm: string, key: string): Hmac;
  }

  export = crypto;
}

// ─── pg ──────────────────────────────────────────────────────────────────────

declare module 'pg' {
  export interface QueryResult<T = Record<string, unknown>> {
    rows: T[];
    rowCount: number | null;
    command: string;
    oid: number;
    fields: unknown[];
  }

  export class Pool {
    constructor(config?: Record<string, unknown>);
    query<T = Record<string, unknown>>(
      text: string,
      values?: unknown[]
    ): Promise<QueryResult<T>>;
    end(): Promise<void>;
  }
}

// ─── Node.js globals ─────────────────────────────────────────────────────────

interface Buffer {
  toString(encoding?: string): string;
}

declare const Buffer: {
  from(data: string, encoding?: string): Buffer;
  from(data: ArrayBuffer | SharedArrayBuffer): Buffer;
};

declare const process: {
  env: Record<string, string | undefined>;
  nextTick(callback: () => void): void;
};

declare function setImmediate(callback: () => void): unknown;
declare function clearImmediate(handle: unknown): void;

// ─── Jest globals ─────────────────────────────────────────────────────────────

declare function describe(name: string, fn: () => void): void;
declare function it(name: string, fn: () => void | Promise<void>): void;
declare function test(name: string, fn: () => void | Promise<void>): void;
declare function beforeEach(fn: () => void | Promise<void>): void;
declare function afterEach(fn: () => void | Promise<void>): void;
declare function beforeAll(fn: () => void | Promise<void>): void;
declare function afterAll(fn: () => void | Promise<void>): void;
declare function expect(value: unknown): jest.Matchers;

// eslint-disable-next-line @typescript-eslint/no-namespace
declare namespace jest {
  // ── Matchers ──────────────────────────────────────────────────────────────

  interface Matchers {
    toBe(expected: unknown): void;
    toEqual(expected: unknown): void;
    toStrictEqual(expected: unknown): void;
    toHaveBeenCalled(): void;
    toHaveBeenCalledWith(...args: unknown[]): void;
    toHaveBeenCalledTimes(n: number): void;
    toHaveLength(n: number): void;
    toBeUndefined(): void;
    toBeDefined(): void;
    toBeNull(): void;
    toBeTruthy(): void;
    toBeFalsy(): void;
    toThrow(message?: string | RegExp | Error): void;
    toContain(item: unknown): void;
    not: Matchers;
    rejects: AsyncMatchers;
    resolves: AsyncMatchers;
  }

  interface AsyncMatchers {
    toThrow(message?: string | RegExp | Error): Promise<void>;
    toBe(expected: unknown): Promise<void>;
    toEqual(expected: unknown): Promise<void>;
    toBeUndefined(): Promise<void>;
  }

  // ── Mock functions ────────────────────────────────────────────────────────

  interface MockInstance {
    mockResolvedValueOnce(value: unknown): this;
    mockRejectedValueOnce(value: unknown): this;
    mockReturnValue(value: unknown): this;
    mockReturnThis(): this;
    mockImplementation(fn: (...args: unknown[]) => unknown): this;
    mockReset(): void;
    mockClear(): void;
  }

  type MockedFunction<T extends (...args: unknown[]) => unknown> = T & MockInstance;

  type Mocked<T> = {
    [K in keyof T]: T[K] extends (...args: infer A) => infer R
      ? MockedFunction<(...args: A) => R>
      : T[K];
  };

  function fn(): MockedFunction<(...args: unknown[]) => unknown>;
  function fn<T extends (...args: unknown[]) => unknown>(impl?: T): MockedFunction<T>;
}
