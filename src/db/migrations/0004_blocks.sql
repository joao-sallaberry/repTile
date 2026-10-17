CREATE TABLE `session_blocks` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`dirty` integer DEFAULT true NOT NULL,
	`session_id` text NOT NULL,
	`workout_block_id` text,
	`position` integer NOT NULL,
	`kind` text NOT NULL,
	`duration_sec` integer,
	`interval_sec` integer,
	`rounds` integer,
	`time_cap_sec` integer,
	`alternate` integer DEFAULT false NOT NULL,
	`notes` text,
	`finished_at` integer,
	`result_time_sec` integer,
	`result_rounds` integer,
	`result_reps` integer,
	`rx` integer DEFAULT true NOT NULL,
	`is_pr` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE INDEX `session_blocks_session_idx` ON `session_blocks` (`session_id`);--> statement-breakpoint
CREATE TABLE `workout_blocks` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`dirty` integer DEFAULT true NOT NULL,
	`workout_id` text NOT NULL,
	`position` integer NOT NULL,
	`kind` text NOT NULL,
	`duration_sec` integer,
	`interval_sec` integer,
	`rounds` integer,
	`time_cap_sec` integer,
	`alternate` integer DEFAULT false NOT NULL,
	`notes` text
);
--> statement-breakpoint
CREATE INDEX `workout_blocks_workout_idx` ON `workout_blocks` (`workout_id`);--> statement-breakpoint
ALTER TABLE `session_sets` ADD `session_block_id` text;--> statement-breakpoint
ALTER TABLE `workout_items` ADD `block_id` text;--> statement-breakpoint
ALTER TABLE `sessions` DROP COLUMN `type`;--> statement-breakpoint
ALTER TABLE `sessions` DROP COLUMN `duration_sec`;--> statement-breakpoint
ALTER TABLE `sessions` DROP COLUMN `interval_sec`;--> statement-breakpoint
ALTER TABLE `sessions` DROP COLUMN `rounds`;--> statement-breakpoint
ALTER TABLE `sessions` DROP COLUMN `time_cap_sec`;--> statement-breakpoint
ALTER TABLE `sessions` DROP COLUMN `result_time_sec`;--> statement-breakpoint
ALTER TABLE `sessions` DROP COLUMN `result_rounds`;--> statement-breakpoint
ALTER TABLE `sessions` DROP COLUMN `result_reps`;--> statement-breakpoint
ALTER TABLE `sessions` DROP COLUMN `rx`;--> statement-breakpoint
ALTER TABLE `sessions` DROP COLUMN `is_pr`;--> statement-breakpoint
ALTER TABLE `workouts` DROP COLUMN `type`;--> statement-breakpoint
ALTER TABLE `workouts` DROP COLUMN `duration_sec`;--> statement-breakpoint
ALTER TABLE `workouts` DROP COLUMN `interval_sec`;--> statement-breakpoint
ALTER TABLE `workouts` DROP COLUMN `rounds`;--> statement-breakpoint
ALTER TABLE `workouts` DROP COLUMN `time_cap_sec`;--> statement-breakpoint
-- Data reset (agreed while the app is in testing): routines and history from before blocks are dropped
-- instead of converted. Exercises, locations and machines are kept.
DELETE FROM `session_sets`;--> statement-breakpoint
DELETE FROM `sessions`;--> statement-breakpoint
DELETE FROM `workout_item_sets`;--> statement-breakpoint
DELETE FROM `workout_items`;--> statement-breakpoint
DELETE FROM `workouts`;
