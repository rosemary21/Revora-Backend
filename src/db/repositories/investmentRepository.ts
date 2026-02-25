import { Pool, QueryResult } from 'pg';

/**
 * Investment entity
 */
export interface Investment {
  id: string;
  investor_id: string;
  offering_id: string;
  amount: string; // Decimal as string to preserve precision
  tokens: string; // Token quantity as string to preserve precision
  status: 'pending' | 'confirmed' | 'cancelled';
  created_at: Date;
  updated_at: Date;
}

/**
 * Options for listing investments by investor
 */
export interface ListByInvestorOptions {
  investor_id: string;
  offering_id?: string;
  limit?: number;
  offset?: number;
}

/**
 * Investment Repository
 * Handles database operations for investments
 */
export class InvestmentRepository {
  constructor(private db: Pool) {}

  /**
   * List investments for a given investor with optional filters and pagination
   * @param options Query options including investor_id, offering_id, limit, offset
   * @returns Array of investments
   */
  async listByInvestor(options: ListByInvestorOptions): Promise<Investment[]> {
    const params: unknown[] = [options.investor_id];
    let paramIndex = 2;

    let query = `
      SELECT *
      FROM investments
      WHERE investor_id = $1
    `;

    if (options.offering_id !== undefined) {
      query += ` AND offering_id = $${paramIndex++}`;
      params.push(options.offering_id);
    }

    query += ' ORDER BY created_at DESC';

    if (options.limit !== undefined) {
      query += ` LIMIT $${paramIndex++}`;
      params.push(options.limit);
    }

    if (options.offset !== undefined) {
      query += ` OFFSET $${paramIndex++}`;
      params.push(options.offset);
    }

    const result: QueryResult<Investment> = await this.db.query(query, params);
    return result.rows.map((row) => this.mapInvestment(row));
  }

  /**
   * Map database row to Investment entity
   */
  private mapInvestment(row: Record<string, unknown>): Investment {
    return {
      id: row.id as string,
      investor_id: row.investor_id as string,
      offering_id: row.offering_id as string,
      amount: row.amount as string,
      tokens: row.tokens as string,
      status: row.status as Investment['status'],
      created_at: row.created_at as Date,
      updated_at: row.updated_at as Date,
    };
  }
}
