CREATE TABLE "credits" (
	"id" text PRIMARY KEY NOT NULL,
	"balance" integer DEFAULT 0 NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jobs" (
	"id" text PRIMARY KEY NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"stage" text DEFAULT 'Received' NOT NULL,
	"error" text,
	"asset_original_key" text NOT NULL,
	"mime" text,
	"duration_ms" integer,
	"transcript_json" text,
	"candidates_json" text,
	"clips_json" text,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
