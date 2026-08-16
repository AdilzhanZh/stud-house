-- Required-document catalog and benefits used to store a single Kazakh-only
-- name/description, so switching the site to Russian left them showing
-- whatever language they were entered in. Split into name_kk/name_ru (and
-- description_kk/description_ru for benefits); the service layer backfills
-- the empty side from the filled one, so entries with only one language
-- typed in still display for both locales.
ALTER TABLE required_documents ADD COLUMN name_kk VARCHAR(255);
ALTER TABLE required_documents ADD COLUMN name_ru VARCHAR(255);
UPDATE required_documents SET name_kk = name, name_ru = name;
ALTER TABLE required_documents ALTER COLUMN name_kk SET NOT NULL;
ALTER TABLE required_documents ALTER COLUMN name_ru SET NOT NULL;
ALTER TABLE required_documents DROP COLUMN name;

ALTER TABLE benefits ADD COLUMN name_kk VARCHAR(255);
ALTER TABLE benefits ADD COLUMN name_ru VARCHAR(255);
ALTER TABLE benefits ADD COLUMN description_kk TEXT;
ALTER TABLE benefits ADD COLUMN description_ru TEXT;
UPDATE benefits SET name_kk = name, name_ru = name, description_kk = description, description_ru = description;
ALTER TABLE benefits ALTER COLUMN name_kk SET NOT NULL;
ALTER TABLE benefits ALTER COLUMN name_ru SET NOT NULL;
ALTER TABLE benefits DROP COLUMN name;
ALTER TABLE benefits DROP COLUMN description;
