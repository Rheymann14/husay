CREATE TABLE `program_statuses` (
	`key` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`color` text NOT NULL,
	`icon` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
-- Built-in statuses that Automatic picks from the program dates. Admins can
-- rename, recolor or change their icons, but not remove them.
INSERT INTO `program_statuses` (`key`, `name`, `color`, `icon`, `sort_order`) VALUES
	('upcoming', 'Upcoming', 'orange', 'calendar-clock', 1),
	('ongoing', 'Ongoing', 'green', 'circle-play', 2),
	('closed', 'Closed', 'red', 'circle-x', 3);--> statement-breakpoint
-- Programs are listed by their dates now, and funding is no longer tracked.
ALTER TABLE `programs` DROP COLUMN `funding_centavos`;--> statement-breakpoint
ALTER TABLE `programs` DROP COLUMN `sort_order`;
