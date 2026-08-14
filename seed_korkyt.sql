-- Seed data for Korkyt Ata Kyzylorda University Student House
DO $$
DECLARE
    admin_id UUID;
    dorm1_id UUID;
    dorm2_id UUID;
    dorm3_id UUID;
    dorm4_id UUID;
    dorm5_id UUID;
    
    doc1_id UUID;
    doc2_id UUID;
    doc3_id UUID;
    doc4_id UUID;
    
    benefit1_id UUID;
    benefit2_id UUID;
    benefit3_id UUID;
    benefit4_id UUID;
    benefit5_id UUID;
    
    m_id UUID;
    c1_id UUID;
    c2_id UUID;
    s1_id UUID;
    s2_id UUID;
    s3_id UUID;
    
    pw_hash TEXT := '$2a$10$nsi3m8ZbSIPkZCqCKt7R1uSo7Qj2geyIfvRsfRo/MRD9pLo8py6ZW'; -- Hash for 'Password123'
BEGIN
    -- Get admin id
    SELECT id INTO admin_id FROM users WHERE role = 'admin' LIMIT 1;
    IF admin_id IS NULL THEN
        RAISE EXCEPTION 'Admin user not found. Please seed the admin first.';
    END IF;

    -- 1. Seed required documents
    IF NOT EXISTS (SELECT 1 FROM required_documents WHERE name = 'Жеке куәлік көшірмесі') THEN
        INSERT INTO required_documents (name) VALUES ('Жеке куәлік көшірмесі');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM required_documents WHERE name = '3х4 сурет (2 дана)') THEN
        INSERT INTO required_documents (name) VALUES ('3х4 сурет (2 дана)');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM required_documents WHERE name = 'Флюорография анықтамасы') THEN
        INSERT INTO required_documents (name) VALUES ('Флюорография анықтамасы');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM required_documents WHERE name = 'Оқу орнынан анықтама') THEN
        INSERT INTO required_documents (name) VALUES ('Оқу орнынан анықтама');
    END IF;

    -- Retrieve IDs
    SELECT id INTO doc1_id FROM required_documents WHERE name = 'Жеке куәлік көшірмесі' LIMIT 1;
    SELECT id INTO doc2_id FROM required_documents WHERE name = '3х4 сурет (2 дана)' LIMIT 1;
    SELECT id INTO doc3_id FROM required_documents WHERE name = 'Флюорография анықтамасы' LIMIT 1;
    SELECT id INTO doc4_id FROM required_documents WHERE name = 'Оқу орнынан анықтама' LIMIT 1;

    -- 2. Seed benefits
    IF NOT EXISTS (SELECT 1 FROM benefits WHERE name = 'Жетім және ата-ана қамқорлығынсыз қалған балалар') THEN
        INSERT INTO benefits (name, description, priority, created_by) VALUES
        ('Жетім және ата-ана қамқорлығынсыз қалған балалар', 'Ата-анасының екеуі де немесе жалғыз ата-анасы қайтыс болған немесе ата-ана құқықтарынан айырылған студенттер', 1, admin_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM benefits WHERE name = 'I және II топтағы мүгедектер') THEN
        INSERT INTO benefits (name, description, priority, created_by) VALUES
        ('I және II топтағы мүгедектер', 'Мүгедектігі туралы анықтамасы бар I немесе II топтағы мүгедек студенттер', 2, admin_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM benefits WHERE name = 'Көпбалалы отбасыдан шыққан студенттер') THEN
        INSERT INTO benefits (name, description, priority, created_by) VALUES
        ('Көпбалалы отбасыдан шыққан студенттер', 'Төрт немесе одан да көп кәмелетке толмаған балалары бар отбасылардан шыққан студенттер', 3, admin_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM benefits WHERE name = 'Ата-анасының біреуі немесе екеуі де мүгедек студенттер') THEN
        INSERT INTO benefits (name, description, priority, created_by) VALUES
        ('Ата-анасының біреуі немесе екеуі де мүгедек студенттер', 'Ата-анасы I немесе II топтағы мүгедек болып табылатын студенттер', 4, admin_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM benefits WHERE name = 'Аз қамтылған отбасы студенттері (АСП алушылар)') THEN
        INSERT INTO benefits (name, description, priority, created_by) VALUES
        ('Аз қамтылған отбасы студенттері (АСП алушылар)', 'Мемлекеттік атаулы әлеуметтік көмек алатын отбасыдан шыққан студенттер', 5, admin_id);
    END IF;

    -- Retrieve benefit IDs
    SELECT id INTO benefit1_id FROM benefits WHERE name = 'Жетім және ата-ана қамқорлығынсыз қалған балалар' LIMIT 1;
    SELECT id INTO benefit2_id FROM benefits WHERE name = 'I және II топтағы мүгедектер' LIMIT 1;
    SELECT id INTO benefit3_id FROM benefits WHERE name = 'Көпбалалы отбасыдан шыққан студенттер' LIMIT 1;
    SELECT id INTO benefit4_id FROM benefits WHERE name = 'Ата-анасының біреуі немесе екеуі де мүгедек студенттер' LIMIT 1;
    SELECT id INTO benefit5_id FROM benefits WHERE name = 'Аз қамтылған отбасы студенттері (АСП алушылар)' LIMIT 1;

    -- Link required documents to benefits
    IF NOT EXISTS (SELECT 1 FROM benefit_required_documents WHERE benefit_id = benefit1_id AND document_id = doc1_id) THEN
        INSERT INTO benefit_required_documents (benefit_id, document_id) VALUES (benefit1_id, doc1_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM benefit_required_documents WHERE benefit_id = benefit1_id AND document_id = doc4_id) THEN
        INSERT INTO benefit_required_documents (benefit_id, document_id) VALUES (benefit1_id, doc4_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM benefit_required_documents WHERE benefit_id = benefit2_id AND document_id = doc1_id) THEN
        INSERT INTO benefit_required_documents (benefit_id, document_id) VALUES (benefit2_id, doc1_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM benefit_required_documents WHERE benefit_id = benefit2_id AND document_id = doc4_id) THEN
        INSERT INTO benefit_required_documents (benefit_id, document_id) VALUES (benefit2_id, doc4_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM benefit_required_documents WHERE benefit_id = benefit3_id AND document_id = doc1_id) THEN
        INSERT INTO benefit_required_documents (benefit_id, document_id) VALUES (benefit3_id, doc1_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM benefit_required_documents WHERE benefit_id = benefit3_id AND document_id = doc4_id) THEN
        INSERT INTO benefit_required_documents (benefit_id, document_id) VALUES (benefit3_id, doc4_id);
    END IF;

    -- 3. Seed dormitories
    IF NOT EXISTS (SELECT 1 FROM dormitories WHERE name = 'Студенттер үйі №1') THEN
        INSERT INTO dormitories (name, address, total_capacity, created_by, phone, dorm_type, floor_count, total_rooms_target, monthly_payment, yearly_payment, built_year, commissioned_year, ownership_form, rooms_male, rooms_female, rooms_mixed) VALUES
        ('Студенттер үйі №1', 'Қызылорда қ., Әйтеке би көшесі, 29А', 300, admin_id, '+7 (7242) 26-12-34', 'corridor', 4, 100, 15000.00, 150000.00, '1975-09-01', '1975-10-15', 'Мемлекеттік меншік', 40, 50, 10);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM dormitories WHERE name = 'Студенттер үйі №2') THEN
        INSERT INTO dormitories (name, address, total_capacity, created_by, phone, dorm_type, floor_count, total_rooms_target, monthly_payment, yearly_payment, built_year, commissioned_year, ownership_form, rooms_male, rooms_female, rooms_mixed) VALUES
        ('Студенттер үйі №2', 'Қызылорда қ., Жақаев көшесі, 75', 200, admin_id, '+7 (7242) 27-56-78', 'sectional', 5, 80, 18000.00, 180000.00, '1982-08-15', '1982-09-01', 'Мемлекеттік меншік', 30, 40, 10);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM dormitories WHERE name = 'Студенттер үйі №3 (Жастар үйі)') THEN
        INSERT INTO dormitories (name, address, total_capacity, created_by, phone, dorm_type, floor_count, total_rooms_target, monthly_payment, yearly_payment, built_year, commissioned_year, ownership_form, rooms_male, rooms_female, rooms_mixed) VALUES
        ('Студенттер үйі №3 (Жастар үйі)', 'Қызылорда қ., Сүлейменов көшесі, 30', 250, admin_id, '+7 (7242) 23-45-67', 'block', 5, 90, 20000.00, 200000.00, '1988-05-10', '1988-08-01', 'Мемлекеттік меншік', 35, 45, 10);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM dormitories WHERE name = 'Студенттер үйі №4') THEN
        INSERT INTO dormitories (name, address, total_capacity, created_by, phone, dorm_type, floor_count, total_rooms_target, monthly_payment, yearly_payment, built_year, commissioned_year, ownership_form, rooms_male, rooms_female, rooms_mixed) VALUES
        ('Студенттер үйі №4', 'Қызылорда қ., Қорқыт Ата көшесі, 120', 150, admin_id, '+7 (7242) 24-78-90', 'corridor', 3, 50, 12000.00, 120000.00, '1970-11-20', '1971-01-10', 'Мемлекеттік меншік', 20, 25, 5);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM dormitories WHERE name = 'Студенттер үйі №5') THEN
        INSERT INTO dormitories (name, address, total_capacity, created_by, phone, dorm_type, floor_count, total_rooms_target, monthly_payment, yearly_payment, built_year, commissioned_year, ownership_form, rooms_male, rooms_female, rooms_mixed) VALUES
        ('Студенттер үйі №5', 'Қызылорда қ., Абай даңғылы, 64', 350, admin_id, '+7 (7242) 25-34-56', 'block', 9, 120, 25000.00, 250000.00, '2020-07-01', '2020-08-25', 'Мемлекеттік меншік', 50, 60, 10);
    END IF;

    -- Retrieve dormitory IDs
    SELECT id INTO dorm1_id FROM dormitories WHERE name = 'Студенттер үйі №1' LIMIT 1;
    SELECT id INTO dorm2_id FROM dormitories WHERE name = 'Студенттер үйі №2' LIMIT 1;
    SELECT id INTO dorm3_id FROM dormitories WHERE name = 'Студенттер үйі №3 (Жастар үйі)' LIMIT 1;
    SELECT id INTO dorm4_id FROM dormitories WHERE name = 'Студенттер үйі №4' LIMIT 1;
    SELECT id INTO dorm5_id FROM dormitories WHERE name = 'Студенттер үйі №5' LIMIT 1;

    -- Link required documents to dormitories
    IF NOT EXISTS (SELECT 1 FROM dormitory_required_documents WHERE dormitory_id = dorm1_id AND document_id = doc1_id) THEN
        INSERT INTO dormitory_required_documents (dormitory_id, document_id) VALUES (dorm1_id, doc1_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM dormitory_required_documents WHERE dormitory_id = dorm1_id AND document_id = doc2_id) THEN
        INSERT INTO dormitory_required_documents (dormitory_id, document_id) VALUES (dorm1_id, doc2_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM dormitory_required_documents WHERE dormitory_id = dorm1_id AND document_id = doc3_id) THEN
        INSERT INTO dormitory_required_documents (dormitory_id, document_id) VALUES (dorm1_id, doc3_id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM dormitory_required_documents WHERE dormitory_id = dorm2_id AND document_id = doc1_id) THEN
        INSERT INTO dormitory_required_documents (dormitory_id, document_id) VALUES (dorm2_id, doc1_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM dormitory_required_documents WHERE dormitory_id = dorm2_id AND document_id = doc2_id) THEN
        INSERT INTO dormitory_required_documents (dormitory_id, document_id) VALUES (dorm2_id, doc2_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM dormitory_required_documents WHERE dormitory_id = dorm2_id AND document_id = doc3_id) THEN
        INSERT INTO dormitory_required_documents (dormitory_id, document_id) VALUES (dorm2_id, doc3_id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM dormitory_required_documents WHERE dormitory_id = dorm5_id AND document_id = doc1_id) THEN
        INSERT INTO dormitory_required_documents (dormitory_id, document_id) VALUES (dorm5_id, doc1_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM dormitory_required_documents WHERE dormitory_id = dorm5_id AND document_id = doc2_id) THEN
        INSERT INTO dormitory_required_documents (dormitory_id, document_id) VALUES (dorm5_id, doc2_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM dormitory_required_documents WHERE dormitory_id = dorm5_id AND document_id = doc3_id) THEN
        INSERT INTO dormitory_required_documents (dormitory_id, document_id) VALUES (dorm5_id, doc3_id);
    END IF;

    -- 4. Seed rooms for Dormitory 1
    IF NOT EXISTS (SELECT 1 FROM rooms WHERE dormitory_id = dorm1_id AND room_number = '101') THEN
        INSERT INTO rooms (dormitory_id, room_number, capacity, restrictions, floor, category, area_sq_m, equipment, top_beds, bottom_beds) VALUES
        (dorm1_id, '101', 3, '{"gender": "male", "courses": [], "benefit_ids": []}'::jsonb, 1, 'general', 18.50, '3 кереует, 3 тумбочка, 1 үстел, 3 орындық, шкаф', 1, 2);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM rooms WHERE dormitory_id = dorm1_id AND room_number = '102') THEN
        INSERT INTO rooms (dormitory_id, room_number, capacity, restrictions, floor, category, area_sq_m, equipment, top_beds, bottom_beds) VALUES
        (dorm1_id, '102', 3, '{"gender": "male", "courses": [], "benefit_ids": []}'::jsonb, 1, 'general', 18.50, '3 кереует, 3 тумбочка, 1 үстел, 3 орындық, шкаф', 1, 2);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM rooms WHERE dormitory_id = dorm1_id AND room_number = '103') THEN
        INSERT INTO rooms (dormitory_id, room_number, capacity, restrictions, floor, category, area_sq_m, equipment, top_beds, bottom_beds) VALUES
        (dorm1_id, '103', 3, '{"gender": "female", "courses": [], "benefit_ids": []}'::jsonb, 1, 'general', 18.50, '3 кереует, 3 тумбочка, 1 үстел, 3 орындық, шкаф', 1, 2);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM rooms WHERE dormitory_id = dorm1_id AND room_number = '104') THEN
        INSERT INTO rooms (dormitory_id, room_number, capacity, restrictions, floor, category, area_sq_m, equipment, top_beds, bottom_beds) VALUES
        (dorm1_id, '104', 3, '{"gender": "female", "courses": [], "benefit_ids": []}'::jsonb, 1, 'general', 18.50, '3 кереует, 3 тумбочка, 1 үстел, 3 орындық, шкаф', 1, 2);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM rooms WHERE dormitory_id = dorm1_id AND room_number = '201') THEN
        INSERT INTO rooms (dormitory_id, room_number, capacity, restrictions, floor, category, area_sq_m, equipment, top_beds, bottom_beds) VALUES
        (dorm1_id, '201', 3, '{"gender": "male", "courses": [1, 2], "benefit_ids": []}'::jsonb, 2, 'general', 18.50, '3 кереует, 3 тумбочка, 1 үстел, 3 орындық, шкаф', 1, 2);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM rooms WHERE dormitory_id = dorm1_id AND room_number = '202') THEN
        INSERT INTO rooms (dormitory_id, room_number, capacity, restrictions, floor, category, area_sq_m, equipment, top_beds, bottom_beds) VALUES
        (dorm1_id, '202', 3, '{"gender": "female", "courses": [1, 2], "benefit_ids": []}'::jsonb, 2, 'general', 18.50, '3 кереует, 3 тумбочка, 1 үстел, 3 орындық, шкаф', 1, 2);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM rooms WHERE dormitory_id = dorm1_id AND room_number = '205') THEN
        INSERT INTO rooms (dormitory_id, room_number, capacity, restrictions, floor, category, area_sq_m, equipment, top_beds, bottom_beds) VALUES
        (dorm1_id, '205', 2, json_build_object('gender', 'male', 'courses', json_build_array(), 'benefit_ids', json_build_array(benefit1_id, benefit2_id))::jsonb, 2, 'special', 15.00, '2 кереует, 2 тумбочка, 1 үстел, 2 орындық, шкаф', 0, 2);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM rooms WHERE dormitory_id = dorm1_id AND room_number = '206') THEN
        INSERT INTO rooms (dormitory_id, room_number, capacity, restrictions, floor, category, area_sq_m, equipment, top_beds, bottom_beds) VALUES
        (dorm1_id, '206', 2, json_build_object('gender', 'female', 'courses', json_build_array(), 'benefit_ids', json_build_array(benefit1_id, benefit2_id))::jsonb, 2, 'special', 15.00, '2 кереует, 2 тумбочка, 1 үстел, 2 орындық, шкаф', 0, 2);
    END IF;

    -- Seed rooms for Dormitory 2
    IF NOT EXISTS (SELECT 1 FROM rooms WHERE dormitory_id = dorm2_id AND room_number = '101') THEN
        INSERT INTO rooms (dormitory_id, room_number, capacity, restrictions, floor, category, area_sq_m, equipment, top_beds, bottom_beds) VALUES
        (dorm2_id, '101', 2, '{"gender": "male", "courses": [], "benefit_ids": []}'::jsonb, 1, 'general', 15.00, '2 кереует, 2 тумбочка, 1 үстел, 2 орындық, шкаф', 0, 2);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM rooms WHERE dormitory_id = dorm2_id AND room_number = '102') THEN
        INSERT INTO rooms (dormitory_id, room_number, capacity, restrictions, floor, category, area_sq_m, equipment, top_beds, bottom_beds) VALUES
        (dorm2_id, '102', 2, '{"gender": "female", "courses": [], "benefit_ids": []}'::jsonb, 1, 'general', 15.00, '2 кереует, 2 тумбочка, 1 үстел, 2 орындық, шкаф', 0, 2);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM rooms WHERE dormitory_id = dorm2_id AND room_number = '201') THEN
        INSERT INTO rooms (dormitory_id, room_number, capacity, restrictions, floor, category, area_sq_m, equipment, top_beds, bottom_beds) VALUES
        (dorm2_id, '201', 4, '{"gender": "male", "courses": [], "benefit_ids": []}'::jsonb, 2, 'general', 24.00, '4 кереует (екі қабатты), 4 тумбочка, 1 үстел, 4 орындық, шкаф', 2, 2);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM rooms WHERE dormitory_id = dorm2_id AND room_number = '202') THEN
        INSERT INTO rooms (dormitory_id, room_number, capacity, restrictions, floor, category, area_sq_m, equipment, top_beds, bottom_beds) VALUES
        (dorm2_id, '202', 4, '{"gender": "female", "courses": [], "benefit_ids": []}'::jsonb, 2, 'general', 24.00, '4 кереует (екі қабатты), 4 тумбочка, 1 үстел, 4 орындық, шкаф', 2, 2);
    END IF;

    -- Seed rooms for Dormitory 5
    IF NOT EXISTS (SELECT 1 FROM rooms WHERE dormitory_id = dorm5_id AND room_number = '101') THEN
        INSERT INTO rooms (dormitory_id, room_number, capacity, restrictions, floor, category, area_sq_m, equipment, top_beds, bottom_beds) VALUES
        (dorm5_id, '101', 2, '{"gender": "male", "courses": [], "benefit_ids": []}'::jsonb, 1, 'superior', 20.00, '2 кереует, 2 тумбочка, 1 үстел, 2 орындық, шкаф, тоңазытқыш', 0, 2);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM rooms WHERE dormitory_id = dorm5_id AND room_number = '102') THEN
        INSERT INTO rooms (dormitory_id, room_number, capacity, restrictions, floor, category, area_sq_m, equipment, top_beds, bottom_beds) VALUES
        (dorm5_id, '102', 2, '{"gender": "female", "courses": [], "benefit_ids": []}'::jsonb, 1, 'superior', 20.00, '2 кереует, 2 тумбочка, 1 үстел, 2 орындық, шкаф, тоңазытқыш', 0, 2);
    END IF;

    -- 5. Seed Users: Manager, Committee members (managers with is_committee_member=true), and Students
    -- Manager
    IF NOT EXISTS (SELECT 1 FROM users WHERE email = 'manager@example.com') THEN
        INSERT INTO users (full_name, email, phone, password_hash, role, approval_status) VALUES
        ('Сәрсенов Марат', 'manager@example.com', '+7 (777) 111-22-33', pw_hash, 'manager', 'approved');
    END IF;
    SELECT id INTO m_id FROM users WHERE email = 'manager@example.com';

    -- Committee Member 1
    IF NOT EXISTS (SELECT 1 FROM users WHERE email = 'committee1@example.com') THEN
        INSERT INTO users (full_name, email, phone, password_hash, role, is_committee_member, approval_status) VALUES
        ('Әлиева Гүлнәр', 'committee1@example.com', '+7 (777) 222-33-44', pw_hash, 'manager', true, 'approved');
    END IF;
    SELECT id INTO c1_id FROM users WHERE email = 'committee1@example.com';

    -- Committee Member 2 (Chairperson)
    IF NOT EXISTS (SELECT 1 FROM users WHERE email = 'committee2@example.com') THEN
        INSERT INTO users (full_name, email, phone, password_hash, role, is_committee_member, is_chairperson, approval_status) VALUES
        ('Жүсіпов Бауыржан', 'committee2@example.com', '+7 (777) 333-44-55', pw_hash, 'manager', true, true, 'approved');
    END IF;
    SELECT id INTO c2_id FROM users WHERE email = 'committee2@example.com';

    -- Student 1 (Male)
    IF NOT EXISTS (SELECT 1 FROM users WHERE email = 'student_male@example.com') THEN
        INSERT INTO users (full_name, email, phone, password_hash, role, iin, approval_status, email_verified_at) VALUES
        ('Серіков Асқар', 'student_male@example.com', '+7 (701) 555-01-01', pw_hash, 'student', '040506501234', 'approved', now());
    END IF;
    SELECT id INTO s1_id FROM users WHERE email = 'student_male@example.com';

    -- Student 2 (Female)
    IF NOT EXISTS (SELECT 1 FROM users WHERE email = 'student_female@example.com') THEN
        INSERT INTO users (full_name, email, phone, password_hash, role, iin, approval_status, email_verified_at) VALUES
        ('Асанова Аружан', 'student_female@example.com', '+7 (702) 555-02-02', pw_hash, 'student', '050607601234', 'approved', now());
    END IF;
    SELECT id INTO s2_id FROM users WHERE email = 'student_female@example.com';

    -- Student 3 (Benefit recipient)
    IF NOT EXISTS (SELECT 1 FROM users WHERE email = 'student_benefit@example.com') THEN
        INSERT INTO users (full_name, email, phone, password_hash, role, iin, approval_status, email_verified_at) VALUES
        ('Нұртас Бағлан', 'student_benefit@example.com', '+7 (705) 555-03-03', pw_hash, 'student', '040812503456', 'approved', now());
    END IF;
    SELECT id INTO s3_id FROM users WHERE email = 'student_benefit@example.com';

    -- 6. Seed Student Profiles
    IF NOT EXISTS (SELECT 1 FROM student_profiles WHERE user_id = s1_id) THEN
        INSERT INTO student_profiles (user_id, gender, course, academic_degree) VALUES
        (s1_id, 'male', 1, 'bachelor');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM student_profiles WHERE user_id = s2_id) THEN
        INSERT INTO student_profiles (user_id, gender, course, academic_degree) VALUES
        (s2_id, 'female', 2, 'bachelor');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM student_profiles WHERE user_id = s3_id) THEN
        INSERT INTO student_profiles (user_id, gender, course, academic_degree) VALUES
        (s3_id, 'male', 3, 'bachelor');
    END IF;

    -- 7. Seed Student Benefits (Student 3 has Benefit 1)
    IF NOT EXISTS (SELECT 1 FROM student_benefits WHERE student_id = s3_id AND benefit_id = benefit1_id) THEN
        INSERT INTO student_benefits (student_id, benefit_id, assigned_by) VALUES
        (s3_id, benefit1_id, admin_id);
    END IF;

END $$;
