-- Registry hierarchy: object -> dormitory (корпус, a physical building) ->
-- floor -> room -> bed.
--
-- A "dormitory" row has always been one building with its own address, so
-- it stays the корпус level. Above it comes the object (dorm_objects): the
-- dormitory as an organisation, with one owner/operator, e.g. the
-- university's student houses, or a private dormitory with several
-- buildings. Every dormitory belongs to exactly one object; admins and
-- managers create objects and move buildings into them.
--
-- Floors get permanent ids like rooms and beds. They are never deleted,
-- only retired (retired_at) once empty. rooms keep floor (the number) as a
-- copy: lots of queries, views and screens read it. The rooms_sync_location
-- trigger derives it (and dormitory_id) from rooms.floor_id on every write,
-- and floors_sync_rooms re-syncs a floor's rooms when it is renumbered.

CREATE TABLE dorm_objects (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(255) NOT NULL,
    -- Who owns or runs it: the university, or a private company/person.
    owner_name      VARCHAR(300),
    -- БИН/ИИН of the owner (12 digits).
    bin             VARCHAR(12),
    -- Moved here from dormitories: it is a property of the owner.
    ownership_form  VARCHAR(100),
    phone           VARCHAR(50),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX uniq_dorm_objects_name ON dorm_objects(lower(name));

ALTER TABLE dormitories ADD COLUMN object_id UUID REFERENCES dorm_objects(id);

DO $$
DECLARE
    -- The university's student houses are one object.
    uni_pattern CONSTANT TEXT := '^\s*(студенттер үйі\s*№\s*[1235]|№\s*[35]\s*жатақхана)\s*$';
    uni UUID;
    d RECORD;
    obj UUID;
BEGIN
    IF EXISTS (SELECT 1 FROM dormitories WHERE name ~* uni_pattern) THEN
        INSERT INTO dorm_objects (name, ownership_form)
        VALUES ('Университет студенттер үйлері',
                (SELECT max(ownership_form) FROM dormitories WHERE name ~* uni_pattern))
        RETURNING id INTO uni;
        UPDATE dormitories SET object_id = uni WHERE name ~* uni_pattern;
    END IF;

    -- Every other dormitory starts as its own object, named after it
    -- (dormitories sharing a name share the object).
    FOR d IN SELECT id, name, ownership_form FROM dormitories WHERE object_id IS NULL ORDER BY created_at LOOP
        SELECT id INTO obj FROM dorm_objects WHERE lower(name) = lower(d.name);
        IF obj IS NULL THEN
            INSERT INTO dorm_objects (name, ownership_form) VALUES (d.name, d.ownership_form)
            RETURNING id INTO obj;
        END IF;
        UPDATE dormitories SET object_id = obj WHERE id = d.id;
    END LOOP;
END $$;

ALTER TABLE dormitories ALTER COLUMN object_id SET NOT NULL;
CREATE INDEX idx_dormitories_object_id ON dormitories(object_id);
ALTER TABLE dormitories DROP COLUMN ownership_form;

-- A dormitory created without an object gets one of its own (or joins the
-- object with exactly its name).
CREATE FUNCTION dormitories_default_object() RETURNS trigger AS $$
BEGIN
    IF NEW.object_id IS NULL THEN
        SELECT id INTO NEW.object_id FROM dorm_objects WHERE lower(name) = lower(NEW.name);
        IF NEW.object_id IS NULL THEN
            INSERT INTO dorm_objects (name) VALUES (NEW.name) RETURNING id INTO NEW.object_id;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER dormitories_default_object
BEFORE INSERT ON dormitories
FOR EACH ROW EXECUTE FUNCTION dormitories_default_object();

-- When the last building leaves an object (moved to another object, i.e.
-- merged, or deleted), the empty object goes too.
CREATE FUNCTION dormitories_drop_empty_object() RETURNS trigger AS $$
BEGIN
    DELETE FROM dorm_objects o
    WHERE o.id = OLD.object_id
      AND NOT EXISTS (SELECT 1 FROM dormitories d WHERE d.object_id = o.id);
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER dormitories_drop_empty_object_on_move
AFTER UPDATE OF object_id ON dormitories
FOR EACH ROW WHEN (OLD.object_id <> NEW.object_id)
EXECUTE FUNCTION dormitories_drop_empty_object();

CREATE TRIGGER dormitories_drop_empty_object_on_delete
AFTER DELETE ON dormitories
FOR EACH ROW EXECUTE FUNCTION dormitories_drop_empty_object();

CREATE TABLE floors (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dormitory_id  UUID NOT NULL REFERENCES dormitories(id) ON DELETE CASCADE,
    -- NULL only for the "floor not set" placeholder that holds rooms created
    -- before floors were required. 0 / negative = ground / basement levels.
    number        INT,
    -- Optional display name ("Цокольный"); the number is shown otherwise.
    name          VARCHAR(100),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    retired_at    TIMESTAMPTZ
);
CREATE INDEX idx_floors_dormitory_id ON floors(dormitory_id);
CREATE UNIQUE INDEX uniq_floors_active_number ON floors(dormitory_id, number) NULLS NOT DISTINCT WHERE retired_at IS NULL;

ALTER TABLE rooms ADD COLUMN floor_id UUID REFERENCES floors(id);

-- Backfill: one floor per floor number the dormitory's rooms already use
-- (rooms without a floor share one "not set" floor).
INSERT INTO floors (dormitory_id, number)
SELECT DISTINCT dormitory_id, floor FROM rooms;

UPDATE rooms r SET floor_id = f.id
FROM floors f
WHERE f.dormitory_id = r.dormitory_id AND f.number IS NOT DISTINCT FROM r.floor;

ALTER TABLE rooms ALTER COLUMN floor_id SET NOT NULL;
CREATE INDEX idx_rooms_floor_id ON rooms(floor_id);

CREATE FUNCTION rooms_sync_location() RETURNS trigger AS $$
BEGIN
    SELECT f.dormitory_id, f.number INTO NEW.dormitory_id, NEW.floor
    FROM floors f WHERE f.id = NEW.floor_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'floor % does not exist', NEW.floor_id USING ERRCODE = 'foreign_key_violation';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER rooms_sync_location
BEFORE INSERT OR UPDATE ON rooms
FOR EACH ROW EXECUTE FUNCTION rooms_sync_location();

CREATE FUNCTION floors_sync_rooms() RETURNS trigger AS $$
BEGIN
    UPDATE rooms SET floor_id = floor_id WHERE floor_id = NEW.id;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER floors_sync_rooms
AFTER UPDATE OF number ON floors
FOR EACH ROW WHEN (OLD.number IS DISTINCT FROM NEW.number)
EXECUTE FUNCTION floors_sync_rooms();

-- A floor never moves to another dormitory (its rooms would silently move
-- buildings with it).
CREATE FUNCTION floors_keep_dormitory() RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'a floor cannot move to another dormitory';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER floors_keep_dormitory
BEFORE UPDATE OF dormitory_id ON floors
FOR EACH ROW WHEN (OLD.dormitory_id <> NEW.dormitory_id)
EXECUTE FUNCTION floors_keep_dormitory();

-- Reports: residents can now be grouped by object too. New columns can
-- only be appended to an existing view.
CREATE OR REPLACE VIEW stats_residents AS
SELECT
    d.name AS dormitory_name,
    r.floor,
    sp.gender::text AS gender,
    sp.course,
    sp.academic_degree::text AS academic_degree,
    EXISTS (SELECT 1 FROM student_benefits sb WHERE sb.student_id = rr.student_id) AS has_benefit,
    count(*)::int AS residents,
    o.name AS object_name
FROM room_residents rr
JOIN rooms r ON r.id = rr.room_id
JOIN dormitories d ON d.id = r.dormitory_id
JOIN dorm_objects o ON o.id = d.object_id
LEFT JOIN student_profiles sp ON sp.user_id = rr.student_id
WHERE rr.moved_out_at IS NULL
GROUP BY 1, 2, 3, 4, 5, 6, 8;
