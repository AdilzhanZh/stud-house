-- Backs the admin/manager "Хабарландыру" screen: a manually composed
-- notification sent to all students, a dormitory's residents, or one
-- student — distinct from every other notification_type, which are all
-- system-generated from application/contract/payment/request state changes.
ALTER TYPE notification_type ADD VALUE 'admin_broadcast';
