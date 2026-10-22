import { Pool } from "pg";
import { createPluginStorage } from "./plugin-api.js";
import { type FeedbackPlugin, feedbackPlugin } from "./plugins/feedback.js";

export interface PluginRuntime {
  feedback: FeedbackPlugin | null;
  close(): Promise<void>;
}

/** No configured or usable database means database-dependent plugins stay off. */
export async function startPlugins(
  connectionString: string | undefined,
): Promise<PluginRuntime> {
  if (!connectionString?.trim()) {
    return { feedback: null, close: async () => {} };
  }
  let pool: Pool | undefined;
  try {
    const db = new Pool({
      connectionString,
      connectionTimeoutMillis: 3_000,
      idleTimeoutMillis: 10_000,
      max: 5,
    });
    pool = db;
    db.on("error", () => {
      console.warn(
        "MDD database connection was lost; feedback may be unavailable.",
      );
    });
    await db.query(`
      CREATE TABLE IF NOT EXISTS mdd_plugin_records (
        id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        plugin_id TEXT NOT NULL,
        value JSONB NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    await db.query(
      "CREATE INDEX IF NOT EXISTS mdd_plugin_records_plugin_id_idx ON mdd_plugin_records (plugin_id)",
    );
    await db.query(
      "CREATE INDEX IF NOT EXISTS mdd_plugin_records_value_idx ON mdd_plugin_records USING GIN (value jsonb_path_ops)",
    );
    return {
      feedback: feedbackPlugin.initialize(
        createPluginStorage(db, feedbackPlugin.id),
      ),
      close: () => db.end(),
    };
  } catch {
    await pool?.end().catch(() => {});
    console.warn(
      "MDD database unavailable; starting with database-dependent plugins disabled.",
    );
    return { feedback: null, close: async () => {} };
  }
}
