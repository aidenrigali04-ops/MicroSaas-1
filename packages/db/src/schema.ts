import { integer, pgTable, text } from "drizzle-orm/pg-core";

export const jobs = pgTable("jobs", {
  id: text("id").primaryKey(),
  status: text("status").notNull().default("queued"),
  stage: text("stage").notNull().default("Received"),
  error: text("error"),
  assetOriginalKey: text("asset_original_key").notNull(),
  mime: text("mime"),
  durationMs: integer("duration_ms"),
  transcriptJson: text("transcript_json"),
  candidatesJson: text("candidates_json"),
  clipsJson: text("clips_json"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const credits = pgTable("credits", {
  id: text("id").primaryKey(),
  balance: integer("balance").notNull().default(0),
  updatedAt: text("updated_at").notNull(),
});
