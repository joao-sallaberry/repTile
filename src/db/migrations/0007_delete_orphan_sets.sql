-- "Adicionar série" / "Adicionar aquecimento" saved sets without a block, so they never showed up.
-- Every set belongs to a block since 0004: soft-delete the ones without one.
UPDATE `session_sets` SET `deleted_at` = CAST(strftime('%s', 'now') AS INTEGER) * 1000, `updated_at` = CAST(strftime('%s', 'now') AS INTEGER) * 1000, `dirty` = 1 WHERE `session_block_id` IS NULL AND `deleted_at` IS NULL;
