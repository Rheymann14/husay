ALTER TABLE `programs` ADD `tracking_no` text DEFAULT '' NOT NULL;--> statement-breakpoint
-- Tracking numbers were HUSAY-<year added>-<id as 4 digits>. Existing programs
-- get 4 random digits from 1000 to 9999 instead; the old numbers start with 0
-- (ids below 1000), so they never clash and still redirect (lib/tracking.ts).
UPDATE `programs` SET `tracking_no` =
	'HUSAY-' || substr(`created_at`, 1, 4) || '-' || (1000 + abs(random() % 9000));--> statement-breakpoint
-- Draw again for any number that came up twice.
UPDATE `programs` SET `tracking_no` =
	'HUSAY-' || substr(`created_at`, 1, 4) || '-' || (1000 + abs(random() % 9000))
WHERE `id` NOT IN (SELECT min(`id`) FROM `programs` GROUP BY `tracking_no`);--> statement-breakpoint
UPDATE `programs` SET `tracking_no` =
	'HUSAY-' || substr(`created_at`, 1, 4) || '-' || (1000 + abs(random() % 9000))
WHERE `id` NOT IN (SELECT min(`id`) FROM `programs` GROUP BY `tracking_no`);--> statement-breakpoint
UPDATE `programs` SET `tracking_no` =
	'HUSAY-' || substr(`created_at`, 1, 4) || '-' || (1000 + abs(random() % 9000))
WHERE `id` NOT IN (SELECT min(`id`) FROM `programs` GROUP BY `tracking_no`);--> statement-breakpoint
CREATE UNIQUE INDEX `programs_tracking_no_idx` ON `programs` (`tracking_no`);
