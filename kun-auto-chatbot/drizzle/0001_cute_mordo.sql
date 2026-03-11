CREATE TABLE `conversations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sessionId` varchar(64) NOT NULL,
	`customerName` varchar(128),
	`customerContact` varchar(256),
	`channel` enum('web','line','facebook','youtube','other') NOT NULL DEFAULT 'web',
	`status` enum('active','closed','follow_up') NOT NULL DEFAULT 'active',
	`leadScore` int DEFAULT 0,
	`leadStatus` enum('new','qualified','hot','converted','lost') NOT NULL DEFAULT 'new',
	`tags` text,
	`summary` text,
	`interestedVehicleIds` text,
	`notifiedOwner` int DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `conversations_id` PRIMARY KEY(`id`),
	CONSTRAINT `conversations_sessionId_unique` UNIQUE(`sessionId`)
);
--> statement-breakpoint
CREATE TABLE `leadEvents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`conversationId` int NOT NULL,
	`eventType` varchar(64) NOT NULL,
	`scoreChange` int NOT NULL,
	`reason` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `leadEvents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `messages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`conversationId` int NOT NULL,
	`role` enum('user','assistant','system') NOT NULL,
	`content` text NOT NULL,
	`metadata` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `messages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `vehicles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`externalId` varchar(32) NOT NULL,
	`sourceUrl` text,
	`title` text,
	`brand` varchar(64) NOT NULL,
	`model` varchar(128) NOT NULL,
	`modelYear` varchar(8),
	`manufactureYear` varchar(8),
	`color` varchar(32),
	`price` decimal(10,1),
	`priceDisplay` varchar(32),
	`mileage` varchar(32),
	`displacement` varchar(32),
	`transmission` varchar(32),
	`fuelType` varchar(32),
	`bodyType` varchar(32),
	`licenseDate` varchar(16),
	`location` varchar(64),
	`description` text,
	`features` text,
	`guarantees` text,
	`photoUrls` text,
	`photoCount` int DEFAULT 0,
	`status` enum('available','sold','reserved') NOT NULL DEFAULT 'available',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `vehicles_id` PRIMARY KEY(`id`),
	CONSTRAINT `vehicles_externalId_unique` UNIQUE(`externalId`)
);
