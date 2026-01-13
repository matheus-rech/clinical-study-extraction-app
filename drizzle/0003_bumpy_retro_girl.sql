CREATE TABLE `agent_extractions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`extractionId` int NOT NULL,
	`provider` enum('gemini','claude','openrouter') NOT NULL,
	`modelName` varchar(128),
	`extractedData` json,
	`processingTimeMs` int,
	`status` enum('pending','extracting','completed','failed') NOT NULL DEFAULT 'pending',
	`errorMessage` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `agent_extractions_id` PRIMARY KEY(`id`)
);
