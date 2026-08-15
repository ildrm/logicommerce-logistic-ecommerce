-- Allow each tenant to explicitly opt in to public customer registration.

ALTER TABLE `Tenant`
  ADD COLUMN `selfRegistrationEnabled` BOOLEAN NOT NULL DEFAULT false;
