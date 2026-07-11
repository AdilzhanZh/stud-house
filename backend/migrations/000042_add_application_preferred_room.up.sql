-- The student now picks a specific room (filtered client-side by gender
-- compatibility) when submitting an application, instead of only a free-text
-- preferred_room_type. A manager may still assign a different room later via
-- RoomService.AddResident — this column is only the student's preference.
ALTER TABLE applications ADD COLUMN preferred_room_id UUID REFERENCES rooms(id);
