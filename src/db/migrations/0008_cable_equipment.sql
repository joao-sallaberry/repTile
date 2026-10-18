-- New "cable" (Polia) equipment: the seed cable exercises move from "machine" to it. Their machine links stay
-- valid (cable exercises also pick a specific station).
UPDATE `exercises` SET `equipment` = 'cable', `updated_at` = CAST(strftime('%s', 'now') AS INTEGER) * 1000, `dirty` = 1 WHERE `id` IN ('seed-cable-crossover', 'seed-face-pull', 'seed-triceps-pushdown') AND `equipment` = 'machine';
