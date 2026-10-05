CREATE TABLE `exercises` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`dirty` integer DEFAULT true NOT NULL,
	`name` text NOT NULL,
	`category` text NOT NULL,
	`measure` text NOT NULL,
	`is_custom` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE `session_sets` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`dirty` integer DEFAULT true NOT NULL,
	`session_id` text NOT NULL,
	`exercise_id` text NOT NULL,
	`position` integer NOT NULL,
	`set_index` integer NOT NULL,
	`reps` integer,
	`weight` real,
	`duration_sec` integer,
	`distance_m` real,
	`calories` integer,
	`rest_sec` integer,
	`completed_at` integer
);
--> statement-breakpoint
CREATE INDEX `session_sets_session_idx` ON `session_sets` (`session_id`);--> statement-breakpoint
CREATE INDEX `session_sets_exercise_idx` ON `session_sets` (`exercise_id`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`dirty` integer DEFAULT true NOT NULL,
	`workout_id` text,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`duration_sec` integer,
	`interval_sec` integer,
	`rounds` integer,
	`time_cap_sec` integer,
	`started_at` integer NOT NULL,
	`finished_at` integer,
	`result_time_sec` integer,
	`result_rounds` integer,
	`result_reps` integer,
	`rx` integer DEFAULT true NOT NULL,
	`notes` text
);
--> statement-breakpoint
CREATE INDEX `sessions_started_idx` ON `sessions` (`started_at`);--> statement-breakpoint
CREATE TABLE `workout_items` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`dirty` integer DEFAULT true NOT NULL,
	`workout_id` text NOT NULL,
	`exercise_id` text NOT NULL,
	`position` integer NOT NULL,
	`sets` integer,
	`reps` integer,
	`weight` real,
	`duration_sec` integer,
	`distance_m` real,
	`calories` integer,
	`rest_sec` integer,
	`notes` text
);
--> statement-breakpoint
CREATE INDEX `workout_items_workout_idx` ON `workout_items` (`workout_id`);--> statement-breakpoint
CREATE TABLE `workouts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`dirty` integer DEFAULT true NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`notes` text,
	`duration_sec` integer,
	`interval_sec` integer,
	`rounds` integer,
	`time_cap_sec` integer
);
