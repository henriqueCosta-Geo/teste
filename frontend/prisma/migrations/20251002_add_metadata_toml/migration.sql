-- Add metadata_toml column to store TOML content directly in database
ALTER TABLE "customers" ADD COLUMN "metadata_toml" TEXT;

-- Migrate existing metadata from files to database (if any)
-- This would need to be done manually or via a script

-- Add comment to deprecated column
COMMENT ON COLUMN "customers"."metadata_file" IS 'DEPRECATED: Use metadata_toml instead';
