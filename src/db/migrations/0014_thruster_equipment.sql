-- Thruster can also be done with dumbbells or kettlebells. Only if the user hasn't changed its equipment.
UPDATE `exercises` SET `equipment` = '["barbell","dumbbell","kettlebell"]', `updated_at` = CAST(unixepoch('subsec') * 1000 AS INTEGER), `dirty` = 1
WHERE `id` = 'seed-thruster' AND `equipment` = '["barbell"]';
