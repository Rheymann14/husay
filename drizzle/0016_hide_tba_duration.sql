-- Programs without dates ("To be announced") hide their Duration of Program.
UPDATE `programs` SET `show_duration` = false
WHERE coalesce(`start_date`, '') = '' AND coalesce(`end_date`, '') = '';
