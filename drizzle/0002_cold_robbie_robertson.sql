CREATE TABLE `schema_templates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int,
	`name` varchar(256) NOT NULL,
	`description` text,
	`studyType` enum('rct','cohort','case_control','cross_sectional','meta_analysis','systematic_review','case_report','qualitative','other') NOT NULL DEFAULT 'other',
	`schema` json NOT NULL,
	`isBuiltIn` boolean NOT NULL DEFAULT false,
	`isPublic` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `schema_templates_id` PRIMARY KEY(`id`)
);
