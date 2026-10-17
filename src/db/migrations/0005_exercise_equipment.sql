ALTER TABLE `exercises` ADD `equipment` text DEFAULT 'none' NOT NULL;
--> statement-breakpoint
-- Equipment of the seed exercises.
UPDATE `exercises` SET `equipment` = 'barbell' WHERE `id` = 'seed-bench-press';
--> statement-breakpoint
UPDATE `exercises` SET `equipment` = 'barbell' WHERE `id` = 'seed-incline-bench-press';
--> statement-breakpoint
UPDATE `exercises` SET `equipment` = 'dumbbell' WHERE `id` = 'seed-db-bench-press';
--> statement-breakpoint
UPDATE `exercises` SET `equipment` = 'dumbbell' WHERE `id` = 'seed-chest-fly';
--> statement-breakpoint
UPDATE `exercises` SET `equipment` = 'machine' WHERE `id` = 'seed-cable-crossover';
--> statement-breakpoint
UPDATE `exercises` SET `equipment` = 'barbell' WHERE `id` = 'seed-deadlift';
--> statement-breakpoint
UPDATE `exercises` SET `equipment` = 'barbell' WHERE `id` = 'seed-barbell-row';
--> statement-breakpoint
UPDATE `exercises` SET `equipment` = 'machine' WHERE `id` = 'seed-seated-row';
--> statement-breakpoint
UPDATE `exercises` SET `equipment` = 'machine' WHERE `id` = 'seed-lat-pulldown';
--> statement-breakpoint
UPDATE `exercises` SET `equipment` = 'other' WHERE `id` = 'seed-pull-up';
--> statement-breakpoint
UPDATE `exercises` SET `equipment` = 'barbell' WHERE `id` = 'seed-back-squat';
--> statement-breakpoint
UPDATE `exercises` SET `equipment` = 'barbell' WHERE `id` = 'seed-front-squat';
--> statement-breakpoint
UPDATE `exercises` SET `equipment` = 'machine' WHERE `id` = 'seed-leg-press';
--> statement-breakpoint
UPDATE `exercises` SET `equipment` = 'machine' WHERE `id` = 'seed-leg-extension';
--> statement-breakpoint
UPDATE `exercises` SET `equipment` = 'machine' WHERE `id` = 'seed-leg-curl';
--> statement-breakpoint
UPDATE `exercises` SET `equipment` = 'barbell' WHERE `id` = 'seed-romanian-deadlift';
--> statement-breakpoint
UPDATE `exercises` SET `equipment` = 'dumbbell' WHERE `id` = 'seed-lunge';
--> statement-breakpoint
UPDATE `exercises` SET `equipment` = 'machine' WHERE `id` = 'seed-calf-raise';
--> statement-breakpoint
UPDATE `exercises` SET `equipment` = 'barbell' WHERE `id` = 'seed-hip-thrust';
--> statement-breakpoint
UPDATE `exercises` SET `equipment` = 'barbell' WHERE `id` = 'seed-overhead-press';
--> statement-breakpoint
UPDATE `exercises` SET `equipment` = 'dumbbell' WHERE `id` = 'seed-lateral-raise';
--> statement-breakpoint
UPDATE `exercises` SET `equipment` = 'dumbbell' WHERE `id` = 'seed-front-raise';
--> statement-breakpoint
UPDATE `exercises` SET `equipment` = 'machine' WHERE `id` = 'seed-face-pull';
--> statement-breakpoint
UPDATE `exercises` SET `equipment` = 'barbell' WHERE `id` = 'seed-barbell-curl';
--> statement-breakpoint
UPDATE `exercises` SET `equipment` = 'dumbbell' WHERE `id` = 'seed-hammer-curl';
--> statement-breakpoint
UPDATE `exercises` SET `equipment` = 'machine' WHERE `id` = 'seed-triceps-pushdown';
--> statement-breakpoint
UPDATE `exercises` SET `equipment` = 'barbell' WHERE `id` = 'seed-skull-crusher';
--> statement-breakpoint
UPDATE `exercises` SET `equipment` = 'other' WHERE `id` = 'seed-dip';
--> statement-breakpoint
UPDATE `exercises` SET `equipment` = 'other' WHERE `id` = 'seed-toes-to-bar';
--> statement-breakpoint
UPDATE `exercises` SET `equipment` = 'other' WHERE `id` = 'seed-ghd-sit-up';
--> statement-breakpoint
UPDATE `exercises` SET `equipment` = 'barbell' WHERE `id` = 'seed-clean';
--> statement-breakpoint
UPDATE `exercises` SET `equipment` = 'barbell' WHERE `id` = 'seed-power-clean';
--> statement-breakpoint
UPDATE `exercises` SET `equipment` = 'barbell' WHERE `id` = 'seed-squat-clean';
--> statement-breakpoint
UPDATE `exercises` SET `equipment` = 'barbell' WHERE `id` = 'seed-clean-and-jerk';
--> statement-breakpoint
UPDATE `exercises` SET `equipment` = 'barbell' WHERE `id` = 'seed-snatch';
--> statement-breakpoint
UPDATE `exercises` SET `equipment` = 'barbell' WHERE `id` = 'seed-power-snatch';
--> statement-breakpoint
UPDATE `exercises` SET `equipment` = 'barbell' WHERE `id` = 'seed-push-press';
--> statement-breakpoint
UPDATE `exercises` SET `equipment` = 'barbell' WHERE `id` = 'seed-push-jerk';
--> statement-breakpoint
UPDATE `exercises` SET `equipment` = 'barbell' WHERE `id` = 'seed-thruster';
--> statement-breakpoint
UPDATE `exercises` SET `equipment` = 'barbell' WHERE `id` = 'seed-overhead-squat';
--> statement-breakpoint
UPDATE `exercises` SET `equipment` = 'kettlebell' WHERE `id` = 'seed-kettlebell-swing';
--> statement-breakpoint
UPDATE `exercises` SET `equipment` = 'other' WHERE `id` = 'seed-wall-ball';
--> statement-breakpoint
UPDATE `exercises` SET `equipment` = 'dumbbell' WHERE `id` = 'seed-db-snatch';
--> statement-breakpoint
UPDATE `exercises` SET `equipment` = 'barbell' WHERE `id` = 'seed-sumo-deadlift-high-pull';
--> statement-breakpoint
UPDATE `exercises` SET `equipment` = 'other' WHERE `id` = 'seed-bar-muscle-up';
--> statement-breakpoint
UPDATE `exercises` SET `equipment` = 'other' WHERE `id` = 'seed-ring-muscle-up';
--> statement-breakpoint
UPDATE `exercises` SET `equipment` = 'other' WHERE `id` = 'seed-chest-to-bar';
--> statement-breakpoint
UPDATE `exercises` SET `equipment` = 'other' WHERE `id` = 'seed-box-jump';
--> statement-breakpoint
UPDATE `exercises` SET `equipment` = 'other' WHERE `id` = 'seed-double-under';
--> statement-breakpoint
UPDATE `exercises` SET `equipment` = 'other' WHERE `id` = 'seed-rope-climb';
--> statement-breakpoint
UPDATE `exercises` SET `equipment` = 'machine' WHERE `id` = 'seed-row-cal';
--> statement-breakpoint
UPDATE `exercises` SET `equipment` = 'machine' WHERE `id` = 'seed-row-distance';
--> statement-breakpoint
UPDATE `exercises` SET `equipment` = 'machine' WHERE `id` = 'seed-bike-cal';
--> statement-breakpoint
UPDATE `exercises` SET `equipment` = 'machine' WHERE `id` = 'seed-ski-erg-cal';
--> statement-breakpoint
-- Exercises already used with a machine are machine exercises.
UPDATE `exercises` SET `equipment` = 'machine' WHERE `id` IN (SELECT `exercise_id` FROM `machine_exercises` WHERE `deleted_at` IS NULL) OR `id` IN (SELECT `exercise_id` FROM `session_sets` WHERE `machine_id` IS NOT NULL) OR `id` IN (SELECT `exercise_id` FROM `workout_items` WHERE `machine_id` IS NOT NULL);
