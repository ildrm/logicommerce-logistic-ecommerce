-- Add optimistic versions to insurance aggregate roots.
ALTER TABLE `CargoInsuranceQuote`
    ADD COLUMN `version` INTEGER NOT NULL DEFAULT 1;

ALTER TABLE `CargoInsurancePolicy`
    ADD COLUMN `version` INTEGER NOT NULL DEFAULT 1;
