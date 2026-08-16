-- Backs the new room degree-level restriction (Room.Restrictions.Degrees),
-- which needs Докторантура as a selectable/matchable value alongside the
-- existing bachelor/master academic degrees.
ALTER TYPE academic_degree_type ADD VALUE 'doctorate';
