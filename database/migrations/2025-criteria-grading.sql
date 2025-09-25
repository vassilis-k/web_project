-- Migration: introduce criteria-based grading and decimals
-- This script avoids IF NOT EXISTS syntax for broad MySQL compatibility (5.7+ and 8.0+).

-- 1) Change thesis.grade to DECIMAL(3,1) (safe to run multiple times)
ALTER TABLE thesis
        MODIFY COLUMN grade DECIMAL(3,1) NULL;

-- 2) Add criteria columns to committee_members only if missing
-- c1_objectives_quality
SET @exists := (
    SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'committee_members' AND COLUMN_NAME = 'c1_objectives_quality'
);
SET @sql := IF(@exists = 0,
    'ALTER TABLE committee_members ADD COLUMN c1_objectives_quality DECIMAL(3,1) NULL',
    'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- c2_duration
SET @exists := (
    SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'committee_members' AND COLUMN_NAME = 'c2_duration'
);
SET @sql := IF(@exists = 0,
    'ALTER TABLE committee_members ADD COLUMN c2_duration DECIMAL(3,1) NULL',
    'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- c3_text_quality
SET @exists := (
    SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'committee_members' AND COLUMN_NAME = 'c3_text_quality'
);
SET @sql := IF(@exists = 0,
    'ALTER TABLE committee_members ADD COLUMN c3_text_quality DECIMAL(3,1) NULL',
    'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- c4_presentation
SET @exists := (
    SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'committee_members' AND COLUMN_NAME = 'c4_presentation'
);
SET @sql := IF(@exists = 0,
    'ALTER TABLE committee_members ADD COLUMN c4_presentation DECIMAL(3,1) NULL',
    'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 3) Ensure committee_members.grade is DECIMAL(3,1)
ALTER TABLE committee_members
        MODIFY COLUMN grade DECIMAL(3,1) NULL;

-- Note: grade_details column is kept for backward compatibility but not used by the new UI.
-- If you want to drop it later:
-- ALTER TABLE committee_members DROP COLUMN grade_details;
