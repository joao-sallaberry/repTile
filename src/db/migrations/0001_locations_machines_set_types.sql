CREATE TABLE `location_machines` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`dirty` integer DEFAULT true NOT NULL,
	`location_id` text NOT NULL,
	`machine_id` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `location_machines_location_idx` ON `location_machines` (`location_id`);--> statement-breakpoint
CREATE INDEX `location_machines_machine_idx` ON `location_machines` (`machine_id`);--> statement-breakpoint
CREATE TABLE `locations` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`dirty` integer DEFAULT true NOT NULL,
	`name` text NOT NULL,
	`kind` text DEFAULT 'gym' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `machine_exercises` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`dirty` integer DEFAULT true NOT NULL,
	`machine_id` text NOT NULL,
	`exercise_id` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `machine_exercises_machine_idx` ON `machine_exercises` (`machine_id`);--> statement-breakpoint
CREATE INDEX `machine_exercises_exercise_idx` ON `machine_exercises` (`exercise_id`);--> statement-breakpoint
CREATE TABLE `machines` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`dirty` integer DEFAULT true NOT NULL,
	`name` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `workout_item_sets` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`dirty` integer DEFAULT true NOT NULL,
	`workout_item_id` text NOT NULL,
	`position` integer NOT NULL,
	`type` text DEFAULT 'normal' NOT NULL,
	`reps` integer,
	`weight` real,
	`duration_sec` integer,
	`distance_m` real,
	`calories` integer
);
--> statement-breakpoint
CREATE INDEX `workout_item_sets_item_idx` ON `workout_item_sets` (`workout_item_id`);--> statement-breakpoint
ALTER TABLE `session_sets` ADD `type` text DEFAULT 'normal' NOT NULL;--> statement-breakpoint
ALTER TABLE `session_sets` ADD `machine_id` text;--> statement-breakpoint
ALTER TABLE `sessions` ADD `location_id` text;--> statement-breakpoint
ALTER TABLE `workout_items` ADD `machine_id` text;--> statement-breakpoint
ALTER TABLE `workouts` ADD `location_id` text;--> statement-breakpoint
-- Data migration: strength items used to store "N sets of R reps at W kg"; expand them into one target row per set.
WITH RECURSIVE n(i) AS (SELECT 0 UNION ALL SELECT i + 1 FROM n WHERE i < 49)
INSERT INTO `workout_item_sets` (`id`, `created_at`, `updated_at`, `dirty`, `workout_item_id`, `position`, `type`, `reps`, `weight`, `duration_sec`, `distance_m`, `calories`)
SELECT lower(hex(randomblob(16))), wi.`created_at`, wi.`updated_at`, 1, wi.`id`, n.i, 'normal', wi.`reps`, wi.`weight`, wi.`duration_sec`, wi.`distance_m`, wi.`calories`
FROM `workout_items` wi
JOIN `workouts` w ON w.`id` = wi.`workout_id`
JOIN n ON n.i < MAX(1, COALESCE(wi.`sets`, 1))
WHERE w.`type` = 'strength' AND wi.`deleted_at` IS NULL;
