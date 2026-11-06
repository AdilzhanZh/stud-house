-- Singleton (mirrors protocol_template): the wording of the referral that
-- managers and admins can edit. Empty until first saved, which means the
-- default in ReferralTemplateService.
CREATE TABLE referral_template (
    id         UUID PRIMARY KEY,
    pages      JSONB NOT NULL,
    updated_by UUID NOT NULL REFERENCES users(id),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT referral_template_singleton CHECK (id = '00000000-0000-0000-0000-000000000006')
);
