ALTER TABLE `programs` ADD `slug` text DEFAULT '' NOT NULL;--> statement-breakpoint
-- Public links use the slug instead of the id. New programs get one from
-- slugify() in the app; existing ones get a close SQL version of it here.
UPDATE `programs` SET `slug` = lower(`title`);--> statement-breakpoint
UPDATE `programs` SET `slug` =
	replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(
	replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(
	replace(replace(replace(`slug`,
		' ', '-'), ',', '-'), '.', '-'), ':', '-'), ';', '-'), '(', '-'), ')', '-'),
		'/', '-'), '&', '-'), '''', '-'), '"', '-'), '–', '-'), '—', '-'), '?', '-'),
		'!', '-'), '+', '-'), '_', '-'), '[', '-'), ']', '-'), char(10), '-'), char(13), '-'),
		'ñ', 'n'), 'Ñ', 'n');--> statement-breakpoint
UPDATE `programs` SET `slug` = replace(replace(replace(replace(`slug`, '--', '-'), '--', '-'), '--', '-'), '--', '-');--> statement-breakpoint
UPDATE `programs` SET `slug` = trim(`slug`, '-');--> statement-breakpoint
-- At most 60 characters, cut after a whole word.
UPDATE `programs` SET `slug` = coalesce(
	nullif(trim(rtrim(substr(`slug`, 1, 61), 'abcdefghijklmnopqrstuvwxyz0123456789'), '-'), ''),
	substr(`slug`, 1, 60)
) WHERE length(`slug`) > 60;--> statement-breakpoint
UPDATE `programs` SET `slug` = 'program-' || `id` WHERE `slug` = '';--> statement-breakpoint
UPDATE `programs` SET `slug` = `slug` || '-' || `id`
WHERE `id` NOT IN (SELECT min(`id`) FROM `programs` GROUP BY `slug`);--> statement-breakpoint
CREATE UNIQUE INDEX `programs_slug_idx` ON `programs` (`slug`);
