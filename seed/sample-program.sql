-- Sample program taken from the Annex A program briefer.
-- Local only: npm run db:seed:local
-- Text fields use simple formatting: lines starting with "- " become bullets,
-- and indented "  - " lines become sub-bullets.

INSERT INTO `programs` (
	`short_name`, `title`, `provider`, `description`,
	`start_date`, `end_date`, `duration_details`, `target_participants`,
	`funding_centavos`, `status_id`, `sort_order`, `is_published`
) VALUES (
	'HEIL Fellowship',
	'Higher Education Innovation Leaders Fellowship Program',
	'Arizona State University - University Design Institute (ASU-UDI)',
	'The program is a specialized 5–6 month program designed to bridge the gap between national policy and institutional execution. Rather than focusing on traditional leadership training, the Fellowship develops leaders as designers and equips them with the methodologies to actively redesign systems, processes, and academic models within their institutions.',
	'2026-10-01',
	'2027-03-31',
	'- Online: Seven sessions of 2-hour virtual masterclasses (including launching)
  - Additional 20 hours of offline coursework, assignments, and preparatory activities for participants
- Onsite:
  - 5-day immersive classes at Arizona State University
  - 1.5-day capstone / culminating session in Manila',
	'All applications received will be evaluated based on the HUSAY scholarship policies and the selection criteria set by ASU-UDI, as follows:

- Decision-makers and forward-thinking leaders from Philippine higher education (SUCs, LUCs, and Private HEIs) and partner government agencies.
- Top-level executives looking to drive systemic change, including Vice Presidents, Vice Chancellors
- Senior administrators, such as Deans, Executive Directors/Directors, and Division Chiefs, who have direct oversight over institutional policies and operations.
- Professionals in Philippine higher education (SUC/LUCs/Private HEI) or government with authority to drive change.
- Committed to higher education change through collaboration, experimentation, & policy change.
- Must possess a valid U.S. visa or successfully secure one prior to the scheduled immersion at Arizona State University (ASU) to guarantee participation in the program.',
	2364729292,
	(SELECT `id` FROM `statuses` WHERE `name` = 'Ongoing'),
	1,
	1
);

INSERT INTO `program_links` (`program_id`, `label`, `url`, `sort_order`)
VALUES (last_insert_rowid(), 'Apply Here', 'https://example.com/replace-with-application-form', 1);
