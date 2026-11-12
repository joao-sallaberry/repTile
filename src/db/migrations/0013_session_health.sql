CREATE TABLE `session_health` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`dirty` integer DEFAULT true NOT NULL,
	`session_id` text NOT NULL,
	`record_id` text,
	`source` text,
	`exercise_type` integer,
	`title` text,
	`started_at` integer,
	`finished_at` integer,
	`avg_hr` integer,
	`max_hr` integer,
	`min_hr` integer,
	`calories` integer,
	`hr_series` text,
	`unlinked` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE INDEX `session_health_session_idx` ON `session_health` (`session_id`);