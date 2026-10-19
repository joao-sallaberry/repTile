PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_exercises` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`dirty` integer DEFAULT true NOT NULL,
	`name` text NOT NULL,
	`category` text NOT NULL,
	`measure` text NOT NULL,
	`equipment` text DEFAULT '["none"]' NOT NULL,
	`is_custom` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_exercises`("id", "user_id", "created_at", "updated_at", "deleted_at", "dirty", "name", "category", "measure", "equipment", "is_custom") SELECT "id", "user_id", "created_at", "updated_at", "deleted_at", "dirty", "name", "category", "measure", "equipment", "is_custom" FROM `exercises`;--> statement-breakpoint
DROP TABLE `exercises`;--> statement-breakpoint
ALTER TABLE `__new_exercises` RENAME TO `exercises`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
ALTER TABLE `session_sets` ADD `equipment` text;--> statement-breakpoint
ALTER TABLE `workout_items` ADD `equipment` text;--> statement-breakpoint
-- An exercise now lists every equipment it can be done with (ADR 0015).
UPDATE `exercises` SET `equipment` = json_array(`equipment`) WHERE json_valid(`equipment`) = 0;
--> statement-breakpoint
-- Seed exercises done with several kinds of equipment, unless the user changed them.
UPDATE `exercises` SET `equipment` = '["barbell","dumbbell","cable"]' WHERE `id` = 'seed-barbell-curl' AND `equipment` = '["barbell"]';
--> statement-breakpoint
UPDATE `exercises` SET `equipment` = '["dumbbell","barbell"]' WHERE `id` = 'seed-lunge' AND `equipment` = '["dumbbell"]';
--> statement-breakpoint
UPDATE `exercises` SET `equipment` = '["barbell","dumbbell","machine"]' WHERE `id` = 'seed-overhead-press' AND `equipment` = '["barbell"]';
--> statement-breakpoint
UPDATE `exercises` SET `equipment` = '["barbell","dumbbell"]' WHERE `id` = 'seed-skull-crusher' AND `equipment` = '["barbell"]';
--> statement-breakpoint
UPDATE `exercises` SET `equipment` = '["dumbbell","cable"]' WHERE `id` IN ('seed-lateral-raise', 'seed-front-raise') AND `equipment` = '["dumbbell"]';
--> statement-breakpoint
UPDATE `exercises` SET `equipment` = '["machine","cable"]' WHERE `id` = 'seed-seated-row' AND `equipment` = '["machine"]';
--> statement-breakpoint
-- What was used so far: a machine when one was recorded (if the exercise has a station), else the exercise's first equipment.
UPDATE `workout_items` SET `equipment` = (
  SELECT CASE
    WHEN `workout_items`.`machine_id` IS NOT NULL AND EXISTS (SELECT 1 FROM json_each(e.`equipment`) WHERE value IN ('machine', 'cable'))
      THEN (SELECT value FROM json_each(e.`equipment`) WHERE value IN ('machine', 'cable') LIMIT 1)
    ELSE json_extract(e.`equipment`, '$[0]')
  END
  FROM `exercises` e WHERE e.`id` = `workout_items`.`exercise_id`
) WHERE `equipment` IS NULL;
--> statement-breakpoint
UPDATE `session_sets` SET `equipment` = (
  SELECT CASE
    WHEN `session_sets`.`machine_id` IS NOT NULL AND EXISTS (SELECT 1 FROM json_each(e.`equipment`) WHERE value IN ('machine', 'cable'))
      THEN (SELECT value FROM json_each(e.`equipment`) WHERE value IN ('machine', 'cable') LIMIT 1)
    ELSE json_extract(e.`equipment`, '$[0]')
  END
  FROM `exercises` e WHERE e.`id` = `session_sets`.`exercise_id`
) WHERE `equipment` IS NULL;
