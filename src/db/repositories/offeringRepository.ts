import { Pool, QueryResult } from 'pg';

export type OfferingStatus =
  | 'draft'
  | 'open'
  | 'closed'
  | 'paused'
  | 'cancelled'
  | string;

export interface Offering {
  id: string;
  issuer_user_id?: string;
  status?: OfferingStatus;
  created_at?: Date;
  updated_at?: Date;
  [key: string]: unknown;
}

export type CreateOfferingInput = Record<string, unknown>;
export type UpdateOfferingInput = Record<string, unknown>;

export interface ListOfferingsFilters {
  status?: OfferingStatus;
  limit?: number;
  offset?: number;
}

export class OfferingRepository {
  constructor(private db: Pool) {}

  async create(offering: CreateOfferingInput): Promise<Offering> {
    const entries = this.getDefinedEntries(offering);
    if (entries.length === 0) {
      throw new Error('create requires at least one offering field');
    }

    const columns = entries.map(([column]) => column);
    const values = entries.map(([, value]) => value);
    const placeholders = values.map((_, index) => `$${index + 1}`);

    const query = `
      INSERT INTO offerings (${columns.join(', ')})
      VALUES (${placeholders.join(', ')})
      RETURNING *
    `;

    const result: QueryResult<Offering> = await this.db.query(query, values);
    if (result.rows.length === 0) {
      throw new Error('Failed to create offering');
    }

    return this.mapOffering(result.rows[0]);
  }

  async getById(id: string): Promise<Offering | null> {
    const query = `
      SELECT *
      FROM offerings
      WHERE id = $1
      LIMIT 1
    `;

    const result: QueryResult<Offering> = await this.db.query(query, [id]);
    if (result.rows.length === 0) {
      return null;
    }

    return this.mapOffering(result.rows[0]);
  }

  async listByIssuer(
    issuerUserId: string,
    filters: ListOfferingsFilters = {}
  ): Promise<Offering[]> {
    const values: unknown[] = [issuerUserId];
    const whereClauses: string[] = ['issuer_user_id = $1'];

    if (filters.status !== undefined) {
      values.push(filters.status);
      whereClauses.push(`status = $${values.length}`);
    }

    let query = `
      SELECT *
      FROM offerings
      WHERE ${whereClauses.join(' AND ')}
      ORDER BY created_at DESC
    `;

    if (filters.limit !== undefined) {
      values.push(filters.limit);
      query += ` LIMIT $${values.length}`;
    }

    if (filters.offset !== undefined) {
      values.push(filters.offset);
      query += ` OFFSET $${values.length}`;
    }

    const result: QueryResult<Offering> = await this.db.query(query, values);
    return result.rows.map((row) => this.mapOffering(row));
  }

  async update(id: string, partial: UpdateOfferingInput): Promise<Offering | null> {
    const entries = this.getDefinedEntries(partial);
    if (entries.length === 0) {
      return this.getById(id);
    }

    const setClauses = entries.map(
      ([column], index) => `${column} = $${index + 1}`
    );
    const values = entries.map(([, value]) => value);
    values.push(id);

    const query = `
      UPDATE offerings
      SET ${setClauses.join(', ')}, updated_at = NOW()
      WHERE id = $${values.length}
      RETURNING *
    `;

    const result: QueryResult<Offering> = await this.db.query(query, values);
    if (result.rows.length === 0) {
      return null;
    }

    return this.mapOffering(result.rows[0]);
  }

  async updateStatus(id: string, status: OfferingStatus): Promise<Offering | null> {
    return this.update(id, { status });
  }

  private getDefinedEntries(payload: Record<string, unknown>) {
    return Object.entries(payload).filter(([, value]) => value !== undefined);
  }

  private mapOffering(row: Record<string, unknown>): Offering {
    return {
      ...(row as Offering),
    };
  }
}
