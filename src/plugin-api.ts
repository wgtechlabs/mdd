import type { Pool } from "pg";

export type PluginValue =
  | string
  | number
  | boolean
  | null
  | PluginValue[]
  | { [key: string]: PluginValue };

export interface PluginRecord<T extends Record<string, PluginValue>> {
  id: string;
  value: T;
  createdAt: Date;
}

export interface PluginStorage {
  get<T extends Record<string, PluginValue>>(
    id: string,
  ): Promise<PluginRecord<T> | null>;
  list<T extends Record<string, PluginValue>>(
    where?: Record<string, string | number | boolean | null>,
    limit?: number,
  ): Promise<PluginRecord<T>[]>;
  count(
    where?: Record<string, string | number | boolean | null>,
  ): Promise<number>;
  countBy(
    field: string,
    where?: Record<string, string | number | boolean | null>,
  ): Promise<Map<string, number>>;
  insert<T extends Record<string, PluginValue>>(
    value: T,
  ): Promise<PluginRecord<T>>;
  update<T extends Record<string, PluginValue>>(
    id: string,
    value: T,
  ): Promise<PluginRecord<T> | null>;
  delete(id: string): Promise<boolean>;
}

export interface MddPlugin<T> {
  id: string;
  initialize(storage: PluginStorage): T;
}

function record<T extends Record<string, PluginValue>>(row: {
  id: string;
  value: T;
  created_at: Date;
}): PluginRecord<T> {
  return { id: row.id, value: row.value, createdAt: row.created_at };
}

/** Create a storage handle restricted to one plugin namespace. */
export function createPluginStorage(
  pool: Pool,
  pluginId: string,
): PluginStorage {
  if (!/^[a-z][a-z0-9-]{0,63}$/.test(pluginId)) {
    throw new Error("Plugin IDs must be lowercase names with hyphens.");
  }

  return {
    async get<T extends Record<string, PluginValue>>(id: string) {
      const result = await pool.query(
        "SELECT id::text, value, created_at FROM mdd_plugin_records WHERE plugin_id = $1 AND id = $2",
        [pluginId, id],
      );
      const row = result.rows[0] as
        | { id: string; value: T; created_at: Date }
        | undefined;
      return row ? record(row) : null;
    },
    async list<T extends Record<string, PluginValue>>(where = {}, limit = 50) {
      if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
        throw new Error("Plugin storage list limit must be between 1 and 100.");
      }
      const result = await pool.query(
        "SELECT id::text, value, created_at FROM mdd_plugin_records WHERE plugin_id = $1 AND value @> $2::jsonb ORDER BY id DESC LIMIT $3",
        [pluginId, JSON.stringify(where), limit],
      );
      return result.rows.map((row) =>
        record(row as { id: string; value: T; created_at: Date }),
      );
    },
    async count(where = {}) {
      const result = await pool.query(
        "SELECT count(*)::text AS count FROM mdd_plugin_records WHERE plugin_id = $1 AND value @> $2::jsonb",
        [pluginId, JSON.stringify(where)],
      );
      return Number(result.rows[0]?.count ?? 0);
    },
    async countBy(field, where = {}) {
      if (!field || field.length > 128) {
        throw new Error("Plugin storage grouping field is invalid.");
      }
      const result = await pool.query(
        "SELECT value ->> $2 AS group_value, count(*)::text AS count FROM mdd_plugin_records WHERE plugin_id = $1 AND value @> $3::jsonb AND value ? $2 AND value ->> $2 IS NOT NULL GROUP BY value ->> $2",
        [pluginId, field, JSON.stringify(where)],
      );
      return new Map(
        result.rows.map((row) => [
          row.group_value as string,
          Number(row.count),
        ]),
      );
    },
    async insert<T extends Record<string, PluginValue>>(value: T) {
      const result = await pool.query(
        "INSERT INTO mdd_plugin_records (plugin_id, value) VALUES ($1, $2::jsonb) RETURNING id::text, value, created_at",
        [pluginId, JSON.stringify(value)],
      );
      return record(
        result.rows[0] as {
          id: string;
          value: T;
          created_at: Date;
        },
      );
    },
    async update<T extends Record<string, PluginValue>>(id: string, value: T) {
      const result = await pool.query(
        "UPDATE mdd_plugin_records SET value = $3::jsonb WHERE plugin_id = $1 AND id = $2 RETURNING id::text, value, created_at",
        [pluginId, id, JSON.stringify(value)],
      );
      const row = result.rows[0] as
        | { id: string; value: T; created_at: Date }
        | undefined;
      return row ? record(row) : null;
    },
    async delete(id: string) {
      const result = await pool.query(
        "DELETE FROM mdd_plugin_records WHERE plugin_id = $1 AND id = $2",
        [pluginId, id],
      );
      return result.rowCount === 1;
    },
  };
}
