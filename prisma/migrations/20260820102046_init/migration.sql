-- CreateTable
CREATE TABLE `users` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `email` VARCHAR(190) NOT NULL,
    `password` VARCHAR(120) NOT NULL,
    `name` VARCHAR(60) NOT NULL,
    `phone` VARCHAR(40) NOT NULL DEFAULT '',
    `org` VARCHAR(120) NOT NULL,
    `role` ENUM('APPLICANT', 'SUPERVISOR') NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `users_email_key`(`email`),
    INDEX `users_role_idx`(`role`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `applications` (
    `id` VARCHAR(16) NOT NULL,
    `product` ENUM('DDL', 'HN') NOT NULL,
    `year` INTEGER NOT NULL,
    `site` VARCHAR(200) NOT NULL,
    `owner` VARCHAR(120) NOT NULL,
    `pm` VARCHAR(60) NOT NULL,
    `channel` ENUM('DIRECT', 'DISTRIBUTION') NOT NULL,
    `code` VARCHAR(60) NOT NULL,
    `moveIn` VARCHAR(7) NOT NULL,
    `installer` VARCHAR(120) NOT NULL,
    `managerName` VARCHAR(60) NOT NULL,
    `managerPhone` VARCHAR(40) NOT NULL,
    `qty` INTEGER NOT NULL,
    `region` VARCHAR(60) NOT NULL,
    `zip` VARCHAR(10) NOT NULL,
    `addr` VARCHAR(255) NOT NULL DEFAULT '',
    `lat` DECIMAL(10, 7) NULL,
    `lng` DECIMAL(10, 7) NULL,
    `link` VARCHAR(40) NOT NULL DEFAULT '',
    `linked` VARCHAR(40) NOT NULL DEFAULT '',
    `board` VARCHAR(60) NOT NULL DEFAULT '',
    `strike` VARCHAR(40) NOT NULL DEFAULT '',
    `other` VARCHAR(40) NOT NULL DEFAULT '',
    `lock1` VARCHAR(60) NOT NULL DEFAULT '',
    `topology` VARCHAR(20) NOT NULL DEFAULT '',
    `main` VARCHAR(60) NOT NULL DEFAULT '',
    `dev1` VARCHAR(60) NOT NULL DEFAULT '',
    `camera` VARCHAR(60) NOT NULL DEFAULT '',
    `lobby` VARCHAR(60) NOT NULL DEFAULT '',
    `dongs` INTEGER NOT NULL DEFAULT 0,
    `status` ENUM('DRAFT', 'SUBMITTED', 'REVIEW_PLANNED', 'REVIEW_APPROVED', 'FIX_REQUESTED', 'FINAL_PENDING', 'PASSED', 'CONDITIONAL', 'FAILED', 'HOLD', 'CARRIED_OVER') NOT NULL,
    `reqDate` DATE NOT NULL,
    `visitDate` DATE NULL,
    `inspectType` ENUM('DOCUMENT', 'SAMPLING') NULL,
    `firstResult` ENUM('PASS', 'CONDITIONAL', 'FAIL', 'HOLD', 'CARRY_OVER') NULL,
    `finalResult` ENUM('PASS', 'CONDITIONAL', 'FAIL', 'HOLD', 'CARRY_OVER') NULL,
    `memo` VARCHAR(1000) NOT NULL DEFAULT '',
    `revComment` VARCHAR(1000) NOT NULL DEFAULT '',
    `firstComment` VARCHAR(1000) NOT NULL DEFAULT '',
    `finalComment` VARCHAR(1000) NOT NULL DEFAULT '',
    `bondNo` VARCHAR(80) NOT NULL DEFAULT '',
    `issuer` VARCHAR(60) NOT NULL DEFAULT '',
    `months` INTEGER NOT NULL DEFAULT 36,
    `bondFrom` DATE NULL,
    `bondTo` DATE NULL,
    `applicantId` INTEGER NOT NULL,
    `inspectorId` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `applications_status_idx`(`status`),
    INDEX `applications_visitDate_idx`(`visitDate`),
    INDEX `applications_reqDate_idx`(`reqDate`),
    INDEX `applications_applicantId_idx`(`applicantId`),
    INDEX `applications_year_product_idx`(`year`, `product`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `application_logs` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `applicationId` VARCHAR(16) NOT NULL,
    `at` DATE NOT NULL,
    `who` VARCHAR(80) NOT NULL,
    `txt` VARCHAR(500) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `application_logs_applicationId_id_idx`(`applicationId`, `id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `notifications` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `applicationId` VARCHAR(16) NOT NULL,
    `channel` ENUM('MAIL', 'SMS') NOT NULL,
    `txt` VARCHAR(500) NOT NULL,
    `at` DATE NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `notifications_applicationId_id_idx`(`applicationId`, `id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `external_visits` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `date` DATE NOT NULL,
    `time` VARCHAR(5) NOT NULL,
    `site` VARCHAR(200) NOT NULL,
    `region` VARCHAR(60) NOT NULL,
    `product` VARCHAR(10) NOT NULL,
    `installer` VARCHAR(120) NOT NULL,
    `manager` VARCHAR(60) NOT NULL,

    INDEX `external_visits_date_idx`(`date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `applications` ADD CONSTRAINT `applications_applicantId_fkey` FOREIGN KEY (`applicantId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `applications` ADD CONSTRAINT `applications_inspectorId_fkey` FOREIGN KEY (`inspectorId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `application_logs` ADD CONSTRAINT `application_logs_applicationId_fkey` FOREIGN KEY (`applicationId`) REFERENCES `applications`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `notifications` ADD CONSTRAINT `notifications_applicationId_fkey` FOREIGN KEY (`applicationId`) REFERENCES `applications`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
