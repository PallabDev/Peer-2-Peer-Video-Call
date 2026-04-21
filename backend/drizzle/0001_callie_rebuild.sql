DROP TABLE IF EXISTS "email_verification_tokens" CASCADE;
DROP TABLE IF EXISTS "password_reset_tokens" CASCADE;
DROP TABLE IF EXISTS "call_logs" CASCADE;
DROP TABLE IF EXISTS "users" CASCADE;
DROP TYPE IF EXISTS "user_role" CASCADE;
DROP TYPE IF EXISTS "access_status" CASCADE;
DROP TYPE IF EXISTS "call_mode" CASCADE;
DROP TYPE IF EXISTS "call_status" CASCADE;

CREATE TYPE "user_role" AS ENUM ('admin', 'user');
CREATE TYPE "access_status" AS ENUM ('pending', 'approved', 'denied');
CREATE TYPE "call_mode" AS ENUM ('audio', 'video');
CREATE TYPE "call_status" AS ENUM ('initiated', 'ringing', 'answered', 'declined', 'missed', 'ended', 'failed', 'cancelled');

CREATE TABLE "users" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "first_name" varchar(80) NOT NULL,
    "last_name" varchar(80),
    "email" varchar(322) NOT NULL,
    "password_hash" text NOT NULL,
    "role" "user_role" DEFAULT 'user' NOT NULL,
    "access_status" "access_status" DEFAULT 'pending' NOT NULL,
    "email_verified" boolean DEFAULT false NOT NULL,
    "expo_push_token" text,
    "approved_by" uuid,
    "approved_at" timestamp,
    "verified_at" timestamp,
    "last_login_at" timestamp,
    "created_at" timestamp DEFAULT now() NOT NULL,
    "updated_at" timestamp DEFAULT now() NOT NULL,
    CONSTRAINT "users_email_unique" UNIQUE("email")
);

CREATE INDEX "users_email_idx" ON "users" ("email");

CREATE TABLE "email_verification_tokens" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
    "token_hash" text NOT NULL,
    "expires_at" timestamp NOT NULL,
    "consumed_at" timestamp,
    "created_at" timestamp DEFAULT now() NOT NULL,
    CONSTRAINT "email_verification_tokens_token_hash_unique" UNIQUE("token_hash")
);

CREATE TABLE "password_reset_tokens" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
    "token_hash" text NOT NULL,
    "expires_at" timestamp NOT NULL,
    "consumed_at" timestamp,
    "created_at" timestamp DEFAULT now() NOT NULL,
    CONSTRAINT "password_reset_tokens_token_hash_unique" UNIQUE("token_hash")
);

CREATE TABLE "call_logs" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "caller_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
    "callee_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
    "mode" "call_mode" NOT NULL,
    "status" "call_status" DEFAULT 'initiated' NOT NULL,
    "metadata" jsonb DEFAULT null,
    "started_at" timestamp DEFAULT now() NOT NULL,
    "answered_at" timestamp,
    "ended_at" timestamp
);
