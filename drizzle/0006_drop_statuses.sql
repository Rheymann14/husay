-- Rebuild `programs` without `status_id`. D1 keeps foreign keys on, so
-- dropping `programs` cascade-deletes its links and sections: keep a copy of
-- them and put them back afterwards.
PRAGMA defer_foreign_keys = on;--> statement-breakpoint
CREATE TABLE `__programs_links_backup` AS SELECT * FROM `program_links`;--> statement-breakpoint
CREATE TABLE `__programs_sections_backup` AS SELECT * FROM `program_sections`;--> statement-breakpoint
CREATE TABLE `__new_programs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`short_name` text NOT NULL,
	`title` text NOT NULL,
	`start_date` text,
	`end_date` text,
	`duration_details` text DEFAULT '' NOT NULL,
	`duration_position` integer DEFAULT 0 NOT NULL,
	`funding_centavos` integer,
	`status` text DEFAULT 'auto' NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`is_published` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_programs`("id", "short_name", "title", "start_date", "end_date", "duration_details", "duration_position", "funding_centavos", "status", "sort_order", "is_published", "created_at", "updated_at") SELECT "id", "short_name", "title", "start_date", "end_date", "duration_details", "duration_position", "funding_centavos", "status", "sort_order", "is_published", "created_at", "updated_at" FROM `programs`;--> statement-breakpoint
DROP TABLE `programs`;--> statement-breakpoint
ALTER TABLE `__new_programs` RENAME TO `programs`;--> statement-breakpoint
DELETE FROM `program_links`;--> statement-breakpoint
INSERT INTO `program_links` SELECT * FROM `__programs_links_backup`;--> statement-breakpoint
DELETE FROM `program_sections`;--> statement-breakpoint
INSERT INTO `program_sections` SELECT * FROM `__programs_sections_backup`;--> statement-breakpoint
DROP TABLE `__programs_links_backup`;--> statement-breakpoint
DROP TABLE `__programs_sections_backup`;--> statement-breakpoint
DROP TABLE `statuses`;
