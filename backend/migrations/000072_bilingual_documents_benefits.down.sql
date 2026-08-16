ALTER TABLE benefits ADD COLUMN name VARCHAR(255);
ALTER TABLE benefits ADD COLUMN description TEXT;
UPDATE benefits SET name = name_kk, description = description_kk;
ALTER TABLE benefits ALTER COLUMN name SET NOT NULL;
ALTER TABLE benefits DROP COLUMN name_kk;
ALTER TABLE benefits DROP COLUMN name_ru;
ALTER TABLE benefits DROP COLUMN description_kk;
ALTER TABLE benefits DROP COLUMN description_ru;

ALTER TABLE required_documents ADD COLUMN name VARCHAR(255);
UPDATE required_documents SET name = name_kk;
ALTER TABLE required_documents ALTER COLUMN name SET NOT NULL;
ALTER TABLE required_documents DROP COLUMN name_kk;
ALTER TABLE required_documents DROP COLUMN name_ru;
