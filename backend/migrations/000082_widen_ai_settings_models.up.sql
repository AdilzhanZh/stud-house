-- Admins now type model ids freely, and OpenRouter ids
-- ("vendor/model:variant") can be longer than Claude ids.
ALTER TABLE ai_settings
    ALTER COLUMN assistant_model TYPE VARCHAR(128),
    ALTER COLUMN document_check_model TYPE VARCHAR(128);
