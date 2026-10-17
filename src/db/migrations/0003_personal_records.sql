ALTER TABLE `session_sets` ADD `is_pr` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `sessions` ADD `is_pr` integer DEFAULT false NOT NULL;