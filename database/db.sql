DROP DATABASE project_web_local;

CREATE DATABASE IF NOT EXISTS project_web_local DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE project_web_local;

CREATE TABLE users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    surname VARCHAR(100) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    landline VARCHAR(20),
    mobile VARCHAR(20),
    street VARCHAR(255),
    street_number VARCHAR(10),
    city VARCHAR(100),
    postal_code VARCHAR(20),
    country VARCHAR(100),
    department VARCHAR(100),
    university VARCHAR(150),
    role ENUM('student', 'professor', 'secretariat') NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE thesis (
    id INT PRIMARY KEY AUTO_INCREMENT,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    description_pdf_url VARCHAR(500),
    status ENUM('available', 'under_assignment', 'active', 'under_review', 'completed', 'cancelled') NOT NULL DEFAULT 'available',
    supervisor_id INT NOT NULL,
    student_id INT NULL,
    gs_approval_protocol VARCHAR(100),
    assignment_date DATE,
    cancellation_reason TEXT,
    presentation_date DATETIME,
    presentation_location VARCHAR(255),
    presentation_mode ENUM('in_person', 'remote'),
    draft_file_url VARCHAR(500),
    extra_material_url VARCHAR(500),
    presentation_details_locked BOOLEAN DEFAULT FALSE,
    grade INT CHECK (grade BETWEEN 0 AND 10),
    repository_url VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (supervisor_id) REFERENCES users(id),
    FOREIGN KEY (student_id) REFERENCES users(id)
);

DELIMITER $$
CREATE TRIGGER set_assignment_date_on_status_change
BEFORE UPDATE ON thesis
FOR EACH ROW
BEGIN
    IF OLD.status != 'active' AND NEW.status = 'active' THEN
        SET NEW.assignment_date = CURDATE();
    END IF;
END$$
DELIMITER ;

CREATE TABLE thesis_files (
    id INT PRIMARY KEY AUTO_INCREMENT,
    thesis_id INT NOT NULL,
    uploader_id INT NOT NULL,
    file_type ENUM('draft', 'video', 'image', 'code', 'pdf', 'other') DEFAULT 'other',
    file_url_or_path VARCHAR(500) NOT NULL,
    description TEXT,
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (thesis_id) REFERENCES thesis(id),
    FOREIGN KEY (uploader_id) REFERENCES users(id)
);


CREATE TABLE committee_invitations (
    id INT PRIMARY KEY AUTO_INCREMENT,
    thesis_id INT NOT NULL,
    invited_professor_id INT NOT NULL,
    status ENUM('pending', 'accepted', 'declined') DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    response_date TIMESTAMP NULL,
    FOREIGN KEY (thesis_id) REFERENCES thesis(id),
    FOREIGN KEY (invited_professor_id) REFERENCES users(id)
);

DELIMITER $$
CREATE TRIGGER check_user_role_before_insert_in_committee_invitations
BEFORE INSERT ON committee_invitations
FOR EACH ROW
BEGIN
    IF (SELECT role FROM users WHERE id = NEW.invited_professor_id) != 'professor' THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'invited_professor_id must reference a user with role professor';
    END IF;
END$$
DELIMITER ;

CREATE TABLE committee_members (
    id INT PRIMARY KEY AUTO_INCREMENT,
    thesis_id INT NOT NULL,
    professor_id INT NOT NULL,
    role ENUM('member') NOT NULL DEFAULT 'member',
    grade INT CHECK (grade BETWEEN 0 AND 10),
    grade_details TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (thesis_id) REFERENCES thesis(id),
    FOREIGN KEY (professor_id) REFERENCES users(id)
);

DELIMITER $$
CREATE TRIGGER check_user_role_before_insert_in_committee_members
BEFORE INSERT ON committee_members
FOR EACH ROW
BEGIN
    IF (SELECT role FROM users WHERE id = NEW.professor_id) != 'professor' THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'professor_id must reference a user with role professor';
    END IF;
END$$
DELIMITER ;

CREATE TABLE progress_notes (
    id INT PRIMARY KEY AUTO_INCREMENT,
    thesis_id INT NOT NULL,
    author_id INT NOT NULL,
    date DATE NOT NULL,
    description TEXT NOT NULL,
    file_url VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (thesis_id) REFERENCES thesis(id),
    FOREIGN KEY (author_id) REFERENCES users(id)
);

CREATE TABLE thesis_announcements (
    id INT PRIMARY KEY AUTO_INCREMENT,
    thesis_id INT NOT NULL,
    announcement_date DATE NOT NULL,
    announcement_time TIME NOT NULL,
    title VARCHAR(255) NOT NULL,
    announcement_text TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (thesis_id) REFERENCES thesis(id)
);

CREATE TABLE thesis_log (
    id INT AUTO_INCREMENT PRIMARY KEY,
    thesis_id INT NOT NULL,
    user_id INT,
    action VARCHAR(255) NOT NULL,
    details TEXT,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (thesis_id) REFERENCES thesis(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE professor_notes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    thesis_id INT NOT NULL,
    professor_id INT NOT NULL,
    note TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (thesis_id) REFERENCES thesis(id) ON DELETE CASCADE,
    FOREIGN KEY (professor_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_thesis_announcements_date ON thesis_announcements(announcement_date);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_thesis_student ON thesis(student_id);
CREATE INDEX idx_thesis_supervisor ON thesis(supervisor_id);
CREATE INDEX idx_thesis_status ON thesis(status);