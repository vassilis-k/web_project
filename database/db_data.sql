INSERT INTO users (name, surname, email, password, role) VALUES
('testName', 'testSurname', 'test@example.com', '$2b$10$h.B3HDjKmI49.Hzjus0KEOjC8kLxBafKwkfpTitkGEwsoTddfn0FC', 'professor');

INSERT INTO users (name, surname, email, password, role) VALUES
('testProfName', 'testProfSurname', 'testProf@example.com', '$2b$10$h.B3HDjKmI49.Hzjus0KEOjC8kLxBafKwkfpTitkGEwsoTddfn0FC', 'professor');

INSERT INTO users (name, surname, email, password, role) VALUES
('testStudName', 'testStudSurname', 'testStud@example.com', '$2b$10$YOmeQneIkagIYp6nfTT5j.HsUKGgP.1AGMWGeCYsGW/tBe4fDAUFu', 'student');

INSERT INTO users (name, surname, email, password, role) VALUES
('testProfName1', 'testProfSurname1', 'testProf1@example.com', '$2b$10$TjGlkGfMhlRMvhxQICEZV.MBpLIpFLnKvt4lH7.0ubGUpz580iuP6', 'professor'),
('testProfName2', 'testProfSurname2', 'testProf2@example.com', '$2b$10$TjGlkGfMhlRMvhxQICEZV.MBpLIpFLnKvt4lH7.0ubGUpz580iuP6', 'professor');

INSERT INTO thesis (title, description, description_pdf_url, supervisor_id, status) VALUES
('Test Thesis', 'Test Description', 'http://example.com/thesis_desc.pdf', 2, 'available');

UPDATE thesis SET student_id = (SELECT id FROM users WHERE email = 'testStud@example.com'), status = 'under_assignment' WHERE id = 1 AND status = 'available';

INSERT INTO users (name, surname, email, password, role) VALUES
('testSecName', 'testSecSurname', 'testSec@example.com', '$2b$10$TayZEN4n29./1yF9IfDAnOYmn6pDsGRclWcU./dxdtJQfvnNfGgwS', 'secretariat');

UPDATE thesis SET status = 'under_review' WHERE id = 1;

--passwords:
--secretariats: test12
--professors: test123
--studentsQtest1234