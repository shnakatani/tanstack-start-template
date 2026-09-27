CREATE TABLE `notes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title` text NOT NULL,
	`body` text DEFAULT '' NOT NULL,
	`due_date` text,
	`created_at` integer NOT NULL,
	CONSTRAINT "notes_due_date_is_calendar_date" CHECK("notes"."due_date" IS date("notes"."due_date") AND length("notes"."due_date") = 10)
);
