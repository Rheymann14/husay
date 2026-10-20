CREATE TABLE `activity_logs` (
	`id` integer PRIMARY KEY NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`user_id` integer,
	`user_name` text NOT NULL,
	`action` text NOT NULL,
	`entity` text NOT NULL,
	`entity_id` text,
	`summary` text NOT NULL
);
