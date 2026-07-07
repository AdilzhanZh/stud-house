CREATE TABLE dormitories (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name                VARCHAR(255) NOT NULL,
    address             VARCHAR(500) NOT NULL,
    total_capacity      INT NOT NULL CHECK (total_capacity >= 0),
    payment_qr_code_url TEXT,
    created_by          UUID NOT NULL REFERENCES users(id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE dormitory_images (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dormitory_id  UUID NOT NULL REFERENCES dormitories(id) ON DELETE CASCADE,
    image_url     TEXT NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_dormitory_images_dormitory_id ON dormitory_images(dormitory_id);
