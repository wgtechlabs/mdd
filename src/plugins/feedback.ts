import type { MddPlugin, PluginStorage } from "../plugin-api.js";

export type FeedbackVote = "yes" | "no";

export interface FeedbackSummary {
  helpfulPercentage: number | null;
}

export interface FeedbackPlugin {
  submit(page: string, vote: FeedbackVote): Promise<void>;
  summary(page: string): Promise<FeedbackSummary>;
}

export function createFeedbackPlugin(storage: PluginStorage): FeedbackPlugin {
  return {
    async submit(page, vote) {
      await storage.insert({ page, vote });
    },
    async summary(page) {
      const counts = await storage.countBy("vote", { page });
      const total = [...counts.values()].reduce((sum, count) => sum + count, 0);
      if (total === 0) return { helpfulPercentage: null };
      const helpful = counts.get("yes") ?? 0;
      return { helpfulPercentage: Math.round((helpful / total) * 100) };
    },
  };
}

export const feedbackPlugin: MddPlugin<FeedbackPlugin> = {
  id: "feedback",
  initialize: createFeedbackPlugin,
};
