ALTER TABLE `programs` ADD `duration_position` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
-- Program Provider, Brief Description and Target Participants become regular
-- briefer rows (program_sections). Existing extra rows move after them, and
-- the built-in Duration row keeps its place after Brief Description.
UPDATE `program_sections` SET `sort_order` = `sort_order` + 3;--> statement-breakpoint
INSERT INTO `program_sections` (`program_id`, `heading`, `body`, `sort_order`)
SELECT `id`, 'Program Provider',
	'<p>' || replace(replace(replace(trim(`provider`), '&', '&amp;'), '<', '&lt;'), '>', '&gt;') || '</p>',
	1
FROM `programs` WHERE trim(`provider`) <> '';--> statement-breakpoint
INSERT INTO `program_sections` (`program_id`, `heading`, `body`, `sort_order`)
SELECT `id`, 'Brief Description', `description`, 2 FROM `programs`;--> statement-breakpoint
INSERT INTO `program_sections` (`program_id`, `heading`, `body`, `sort_order`)
SELECT `id`, 'Description / Profile of Target Participants', `target_participants`, 3 FROM `programs`;--> statement-breakpoint
UPDATE `programs` SET `duration_position` = (
	SELECT count(*) FROM `program_sections` s
	WHERE s.`program_id` = `programs`.`id` AND s.`sort_order` <= 2
);
