-- "Supino com halteres" becomes the dumbbell variant of "Supino reto" (ADR 0015): move its history, routines and machines.
UPDATE `workout_items` SET `exercise_id` = 'seed-bench-press', `equipment` = 'dumbbell' WHERE `exercise_id` = 'seed-db-bench-press';
--> statement-breakpoint
UPDATE `session_sets` SET `exercise_id` = 'seed-bench-press', `equipment` = 'dumbbell' WHERE `exercise_id` = 'seed-db-bench-press';
--> statement-breakpoint
UPDATE `machine_exercises` SET `exercise_id` = 'seed-bench-press' WHERE `exercise_id` = 'seed-db-bench-press';
--> statement-breakpoint
UPDATE `exercises` SET `deleted_at` = CAST(unixepoch('subsec') * 1000 AS INTEGER), `dirty` = 1 WHERE `id` = 'seed-db-bench-press';
--> statement-breakpoint
-- More equipment for seed exercises, unless the user changed them.
UPDATE `exercises` SET `equipment` = '["barbell","dumbbell"]' WHERE `id` IN ('seed-bench-press', 'seed-incline-bench-press') AND `equipment` = '["barbell"]';
--> statement-breakpoint
UPDATE `exercises` SET `equipment` = '["dumbbell","cable"]' WHERE `id` = 'seed-hammer-curl' AND `equipment` = '["dumbbell"]';
--> statement-breakpoint
UPDATE `exercises` SET `equipment` = '["dumbbell","cable","barbell"]' WHERE `id` = 'seed-front-raise' AND `equipment` = '["dumbbell","cable"]';
--> statement-breakpoint
-- A bench press that had only the barbell still needs the dumbbell for the merged sets.
UPDATE `exercises` SET `equipment` = json_insert(`equipment`, '$[#]', 'dumbbell')
WHERE `id` = 'seed-bench-press'
  AND NOT EXISTS (SELECT 1 FROM json_each(`equipment`) WHERE value = 'dumbbell')
  AND EXISTS (SELECT 1 FROM `session_sets` WHERE `exercise_id` = 'seed-bench-press' AND `equipment` = 'dumbbell'
              UNION SELECT 1 FROM `workout_items` WHERE `exercise_id` = 'seed-bench-press' AND `equipment` = 'dumbbell');
