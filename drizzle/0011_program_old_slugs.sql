CREATE TABLE `program_old_slugs` (
	`slug` text PRIMARY KEY NOT NULL,
	`program_id` integer NOT NULL,
	FOREIGN KEY (`program_id`) REFERENCES `programs`(`id`) ON UPDATE no action ON DELETE cascade
);
