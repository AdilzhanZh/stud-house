-- Backs two new manager-initiated room actions (RoomService.MoveOutResident's
-- notification and the new RoomService.TransferResident): releasing a
-- resident from their room, and transferring a resident directly to a
-- different room, both outside the existing exit/transfer request
-- approval workflows.
ALTER TYPE notification_type ADD VALUE 'room_resident_released';
ALTER TYPE notification_type ADD VALUE 'room_resident_transferred';
