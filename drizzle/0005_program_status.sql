ALTER TABLE `programs` ADD `status` text DEFAULT 'auto' NOT NULL;--> statement-breakpoint
-- Status now follows the program dates. Programs without any dates keep their
-- old status as a manual override so they don't lose it.
UPDATE `programs` SET `status` = (
	SELECT lower(s.`name`) FROM `statuses` s WHERE s.`id` = `programs`.`status_id`
)
WHERE `start_date` IS NULL AND `end_date` IS NULL AND `status_id` IN (
	SELECT `id` FROM `statuses` WHERE lower(`name`) IN ('upcoming', 'ongoing', 'closed')
);
