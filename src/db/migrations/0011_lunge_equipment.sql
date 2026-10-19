-- "Livre" (none) can now be combined with other equipment (ADR 0017).
-- Only seed exercises the user hasn't changed.
UPDATE `exercises` SET `equipment` = '["dumbbell","barbell","none"]', `updated_at` = CAST(unixepoch('subsec') * 1000 AS INTEGER), `dirty` = 1
WHERE `id` = 'seed-lunge' AND `equipment` = '["dumbbell","barbell"]';
--> statement-breakpoint
UPDATE `exercises` SET `equipment` = '["none","dumbbell"]', `updated_at` = CAST(unixepoch('subsec') * 1000 AS INTEGER), `dirty` = 1
WHERE `id` = 'seed-side-lunge' AND `equipment` = '["none"]';
--> statement-breakpoint
UPDATE `exercises` SET `measure` = 'weight_reps' WHERE `id` = 'seed-side-lunge' AND `measure` = 'reps';
