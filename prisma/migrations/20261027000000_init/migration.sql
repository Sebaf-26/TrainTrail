-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "unaccent";

-- CreateTable
CREATE TABLE "app_config" (
    "id" SERIAL NOT NULL,
    "config" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "app_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "password" TEXT,
    "role_id" TEXT,
    "is_owner" BOOLEAN NOT NULL DEFAULT false,
    "role_assignment_source" TEXT NOT NULL DEFAULT 'local',
    "oauth_id" TEXT,
    "distance_unit" TEXT NOT NULL DEFAULT 'km',
    "time_format" TEXT NOT NULL DEFAULT 'auto',
    "date_format" TEXT NOT NULL DEFAULT 'auto',
    "week_starts_on" TEXT NOT NULL DEFAULT 'auto',
    "journey_time_display" TEXT NOT NULL DEFAULT 'station',

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "access_role" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "access_role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "access_role_permission" (
    "role_id" TEXT NOT NULL,
    "permission" TEXT NOT NULL,

    CONSTRAINT "access_role_permission_pkey" PRIMARY KEY ("role_id","permission")
);

-- CreateTable
CREATE TABLE "authorization_settings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "default_role_id" TEXT NOT NULL,
    "oauth_role_mapping_mode" TEXT NOT NULL DEFAULT 'off',

    CONSTRAINT "authorization_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "oauth_role_mapping" (
    "id" SERIAL NOT NULL,
    "priority" INTEGER NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "claim_source" TEXT NOT NULL,
    "claim_path" TEXT NOT NULL,
    "operator" TEXT NOT NULL,
    "claim_value" TEXT NOT NULL,
    "role_id" TEXT NOT NULL,

    CONSTRAINT "oauth_role_mapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "oauth_link_token" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "oauth_sub" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "oauth_link_token_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "station" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "uic" TEXT,
    "viaggiatreno_id" TEXT,
    "lat" DOUBLE PRECISION NOT NULL,
    "lon" DOUBLE PRECISION NOT NULL,
    "tz" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "municipality" TEXT,
    "type" TEXT NOT NULL,
    "continent" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "custom" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "station_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "train" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "source_id" TEXT,

    CONSTRAINT "train_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "operator" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "icon_path" TEXT,
    "source_id" TEXT,

    CONSTRAINT "operator_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "journey" (
    "id" SERIAL NOT NULL,
    "date" TEXT NOT NULL,
    "date_precision" TEXT NOT NULL DEFAULT 'day',
    "departure" TEXT,
    "arrival" TEXT,
    "departure_scheduled" TEXT,
    "arrival_scheduled" TEXT,
    "duration" INTEGER,
    "departure_platform" TEXT,
    "arrival_platform" TEXT,
    "train_number" TEXT,
    "unit_number" TEXT,
    "note" TEXT,
    "from_id" INTEGER,
    "to_id" INTEGER,
    "train_id" INTEGER,
    "operator_id" INTEGER,

    CONSTRAINT "journey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "journey_track" (
    "journey_id" INTEGER NOT NULL,
    "track" JSONB NOT NULL,
    "source_format" TEXT NOT NULL,
    "source_name" TEXT,
    "point_count" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "journey_track_pkey" PRIMARY KEY ("journey_id")
);

-- CreateTable
CREATE TABLE "journey_passenger" (
    "id" SERIAL NOT NULL,
    "journey_id" INTEGER NOT NULL,
    "user_id" TEXT,
    "guest_name" TEXT,
    "seat" TEXT,
    "coach" TEXT,
    "seat_number" TEXT,
    "seat_class" TEXT,
    "journey_reason" TEXT,

    CONSTRAINT "journey_passenger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "visited_country" (
    "id" SERIAL NOT NULL,
    "code" VARCHAR(2) NOT NULL,
    "status" TEXT NOT NULL,
    "note" TEXT,
    "user_id" TEXT NOT NULL,

    CONSTRAINT "visited_country_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session" (
    "id" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "user_id" TEXT NOT NULL,

    CONSTRAINT "session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_key" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_used" TIMESTAMPTZ,
    "scopes" TEXT[],

    CONSTRAINT "api_key_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "oauth_client" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "client_secret_hash" TEXT,
    "token_endpoint_auth_method" TEXT NOT NULL DEFAULT 'none',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "oauth_client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "oauth_client_redirect_uri" (
    "client_id" TEXT NOT NULL,
    "redirect_uri" TEXT NOT NULL,

    CONSTRAINT "oauth_client_redirect_uri_pkey" PRIMARY KEY ("client_id","redirect_uri")
);

-- CreateTable
CREATE TABLE "oauth_authorization_request" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "user_id" TEXT,
    "redirect_uri" TEXT NOT NULL,
    "scopes" TEXT[],
    "resource" TEXT NOT NULL,
    "state" TEXT,
    "code_challenge" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "oauth_authorization_request_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "oauth_grant" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "scopes" TEXT[],
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "oauth_grant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "oauth_authorization_code" (
    "code_hash" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "grant_id" TEXT NOT NULL,
    "redirect_uri" TEXT NOT NULL,
    "scopes" TEXT[],
    "resource" TEXT NOT NULL,
    "code_challenge" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "used_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "oauth_authorization_code_pkey" PRIMARY KEY ("code_hash")
);

-- CreateTable
CREATE TABLE "oauth_access_token" (
    "token_hash" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "grant_id" TEXT NOT NULL,
    "refresh_family_id" TEXT,
    "scopes" TEXT[],
    "resource" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "revoked_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "oauth_access_token_pkey" PRIMARY KEY ("token_hash")
);

-- CreateTable
CREATE TABLE "oauth_refresh_token" (
    "token_hash" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "grant_id" TEXT NOT NULL,
    "family_id" TEXT NOT NULL,
    "scopes" TEXT[],
    "resource" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "used_at" TIMESTAMPTZ,
    "revoked_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "oauth_refresh_token_pkey" PRIMARY KEY ("token_hash")
);

-- CreateTable
CREATE TABLE "public_share" (
    "id" SERIAL NOT NULL,
    "user_id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "show_map" BOOLEAN NOT NULL DEFAULT true,
    "show_stats" BOOLEAN NOT NULL DEFAULT false,
    "show_journey_list" BOOLEAN NOT NULL DEFAULT false,
    "date_from" TEXT,
    "date_to" TEXT,
    "show_train_numbers" BOOLEAN NOT NULL DEFAULT true,
    "show_operators" BOOLEAN NOT NULL DEFAULT true,
    "show_train" BOOLEAN NOT NULL DEFAULT false,
    "show_times" BOOLEAN NOT NULL DEFAULT false,
    "show_tracks" BOOLEAN NOT NULL DEFAULT false,
    "show_dates" BOOLEAN NOT NULL DEFAULT true,
    "show_seat" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "public_share_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "custom_field_definition" (
    "id" SERIAL NOT NULL,
    "entity_type" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "field_type" TEXT NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "default_value" JSONB,
    "options" JSONB,
    "validation_json" JSONB,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "custom_field_definition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "custom_field_value" (
    "id" SERIAL NOT NULL,
    "field_id" INTEGER NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "custom_field_value_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_username_key" ON "user"("username");

-- CreateIndex
CREATE UNIQUE INDEX "user_oauth_id_key" ON "user"("oauth_id");

-- CreateIndex
CREATE UNIQUE INDEX "authorization_settings_default_role_id_key" ON "authorization_settings"("default_role_id");

-- CreateIndex
CREATE INDEX "oauth_role_mapping_priority_idx" ON "oauth_role_mapping"("priority");

-- CreateIndex
CREATE UNIQUE INDEX "oauth_link_token_token_key" ON "oauth_link_token"("token");

-- CreateIndex
CREATE UNIQUE INDEX "oauth_link_token_user_id_key" ON "oauth_link_token"("user_id");

-- CreateIndex
CREATE INDEX "oauth_link_token_token_idx" ON "oauth_link_token"("token");

-- CreateIndex
CREATE UNIQUE INDEX "station_code_key" ON "station"("code");

-- CreateIndex
CREATE INDEX "train_source_id_idx" ON "train"("source_id");

-- CreateIndex
CREATE INDEX "operator_source_id_idx" ON "operator"("source_id");

-- CreateIndex
CREATE INDEX "journey_from_id_idx" ON "journey"("from_id");

-- CreateIndex
CREATE INDEX "journey_to_id_idx" ON "journey"("to_id");

-- CreateIndex
CREATE UNIQUE INDEX "journey_passenger_user_id_journey_id_key" ON "journey_passenger"("journey_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "journey_passenger_journey_id_guest_name_key" ON "journey_passenger"("journey_id", "guest_name");

-- CreateIndex
CREATE UNIQUE INDEX "visited_country_code_user_id_key" ON "visited_country"("code", "user_id");

-- CreateIndex
CREATE INDEX "oauth_authorization_request_expires_at_idx" ON "oauth_authorization_request"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "oauth_grant_client_id_user_id_resource_key" ON "oauth_grant"("client_id", "user_id", "resource");

-- CreateIndex
CREATE INDEX "oauth_authorization_code_expires_at_idx" ON "oauth_authorization_code"("expires_at");

-- CreateIndex
CREATE INDEX "oauth_access_token_expires_at_idx" ON "oauth_access_token"("expires_at");

-- CreateIndex
CREATE INDEX "oauth_access_token_refresh_family_id_idx" ON "oauth_access_token"("refresh_family_id");

-- CreateIndex
CREATE INDEX "oauth_refresh_token_family_id_idx" ON "oauth_refresh_token"("family_id");

-- CreateIndex
CREATE INDEX "oauth_refresh_token_expires_at_idx" ON "oauth_refresh_token"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "public_share_slug_key" ON "public_share"("slug");

-- CreateIndex
CREATE INDEX "public_share_slug_idx" ON "public_share"("slug");

-- CreateIndex
CREATE INDEX "public_share_user_id_idx" ON "public_share"("user_id");

-- CreateIndex
CREATE INDEX "custom_field_definition_entity_type_active_order_idx" ON "custom_field_definition"("entity_type", "active", "order");

-- CreateIndex
CREATE UNIQUE INDEX "custom_field_definition_entity_type_key_key" ON "custom_field_definition"("entity_type", "key");

-- CreateIndex
CREATE INDEX "custom_field_value_entity_type_entity_id_idx" ON "custom_field_value"("entity_type", "entity_id");

-- CreateIndex
CREATE UNIQUE INDEX "custom_field_value_field_id_entity_type_entity_id_key" ON "custom_field_value"("field_id", "entity_type", "entity_id");

-- AddForeignKey
ALTER TABLE "user" ADD CONSTRAINT "user_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "access_role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "access_role_permission" ADD CONSTRAINT "access_role_permission_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "access_role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "authorization_settings" ADD CONSTRAINT "authorization_settings_default_role_id_fkey" FOREIGN KEY ("default_role_id") REFERENCES "access_role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "oauth_role_mapping" ADD CONSTRAINT "oauth_role_mapping_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "access_role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "oauth_link_token" ADD CONSTRAINT "oauth_link_token_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journey" ADD CONSTRAINT "journey_from_id_fkey" FOREIGN KEY ("from_id") REFERENCES "station"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journey" ADD CONSTRAINT "journey_to_id_fkey" FOREIGN KEY ("to_id") REFERENCES "station"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journey" ADD CONSTRAINT "journey_train_id_fkey" FOREIGN KEY ("train_id") REFERENCES "train"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journey" ADD CONSTRAINT "journey_operator_id_fkey" FOREIGN KEY ("operator_id") REFERENCES "operator"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journey_track" ADD CONSTRAINT "journey_track_journey_id_fkey" FOREIGN KEY ("journey_id") REFERENCES "journey"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journey_passenger" ADD CONSTRAINT "journey_passenger_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journey_passenger" ADD CONSTRAINT "journey_passenger_journey_id_fkey" FOREIGN KEY ("journey_id") REFERENCES "journey"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visited_country" ADD CONSTRAINT "visited_country_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_key" ADD CONSTRAINT "api_key_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "oauth_client_redirect_uri" ADD CONSTRAINT "oauth_client_redirect_uri_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "oauth_client"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "oauth_authorization_request" ADD CONSTRAINT "oauth_authorization_request_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "oauth_client"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "oauth_authorization_request" ADD CONSTRAINT "oauth_authorization_request_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "oauth_grant" ADD CONSTRAINT "oauth_grant_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "oauth_client"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "oauth_grant" ADD CONSTRAINT "oauth_grant_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "oauth_authorization_code" ADD CONSTRAINT "oauth_authorization_code_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "oauth_client"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "oauth_authorization_code" ADD CONSTRAINT "oauth_authorization_code_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "oauth_authorization_code" ADD CONSTRAINT "oauth_authorization_code_grant_id_fkey" FOREIGN KEY ("grant_id") REFERENCES "oauth_grant"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "oauth_access_token" ADD CONSTRAINT "oauth_access_token_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "oauth_client"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "oauth_access_token" ADD CONSTRAINT "oauth_access_token_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "oauth_access_token" ADD CONSTRAINT "oauth_access_token_grant_id_fkey" FOREIGN KEY ("grant_id") REFERENCES "oauth_grant"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "oauth_refresh_token" ADD CONSTRAINT "oauth_refresh_token_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "oauth_client"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "oauth_refresh_token" ADD CONSTRAINT "oauth_refresh_token_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "oauth_refresh_token" ADD CONSTRAINT "oauth_refresh_token_grant_id_fkey" FOREIGN KEY ("grant_id") REFERENCES "oauth_grant"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public_share" ADD CONSTRAINT "public_share_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "custom_field_value" ADD CONSTRAINT "custom_field_value_field_id_fkey" FOREIGN KEY ("field_id") REFERENCES "custom_field_definition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Constraints and indexes that the Prisma schema cannot express.
ALTER TABLE "authorization_settings"
  ADD CONSTRAINT "authorization_settings_singleton_check" CHECK ("id" = 1),
  ADD CONSTRAINT "authorization_settings_oauth_role_mapping_mode_check"
    CHECK ("oauth_role_mapping_mode" IN ('off', 'on_create', 'on_login'));

ALTER TABLE "oauth_client"
  ADD CONSTRAINT "oauth_client_auth_method_check"
    CHECK ("token_endpoint_auth_method" IN ('none', 'client_secret_post'));

ALTER TABLE "oauth_role_mapping"
  ADD CONSTRAINT "oauth_role_mapping_claim_source_check"
    CHECK ("claim_source" IN ('userinfo', 'id_token')),
  ADD CONSTRAINT "oauth_role_mapping_operator_check"
    CHECK ("operator" IN ('equals', 'contains'));

ALTER TABLE "user"
  ADD CONSTRAINT "user_owner_role_check"
    CHECK (("is_owner" AND "role_id" IS NULL) OR (NOT "is_owner" AND "role_id" IS NOT NULL)),
  ADD CONSTRAINT "user_role_assignment_source_check"
    CHECK ("role_assignment_source" IN ('local', 'oauth'));

CREATE UNIQUE INDEX "access_role_name_ci_key" ON "access_role" (LOWER("name"));
CREATE UNIQUE INDEX "user_single_owner_key" ON "user" ("is_owner") WHERE "is_owner";

-- Custom field values belong to a journey or passenger row; remove them with it.
CREATE FUNCTION "cleanup_custom_field_values_for_entity"() RETURNS trigger
  LANGUAGE plpgsql AS $$
BEGIN
  IF TG_TABLE_NAME = 'journey' THEN
    DELETE FROM "custom_field_value"
    WHERE "entity_type" = 'journey'
      AND "entity_id" = OLD."id"::text;
  ELSIF TG_TABLE_NAME = 'journey_passenger' THEN
    DELETE FROM "custom_field_value"
    WHERE "entity_type" = 'journey_passenger'
      AND "entity_id" = OLD."id"::text;
  END IF;

  RETURN OLD;
END;
$$;

CREATE TRIGGER "journey_custom_field_value_cleanup"
  AFTER DELETE ON "journey"
  FOR EACH ROW EXECUTE FUNCTION "cleanup_custom_field_values_for_entity"();

CREATE TRIGGER "journey_passenger_custom_field_value_cleanup"
  AFTER DELETE ON "journey_passenger"
  FOR EACH ROW EXECUTE FUNCTION "cleanup_custom_field_values_for_entity"();

-- Default roles and the permissions they grant.
INSERT INTO "access_role" ("id", "name", "description") VALUES
  ('role-user', 'User', 'Manage personal journeys and account data.'),
  ('role-administrator', 'Administrator', 'Manage users, journeys, reference data, and instance settings.');

INSERT INTO "access_role_permission" ("role_id", "permission") VALUES
  ('role-user', 'journey.read.own'),
  ('role-user', 'journey.create.own'),
  ('role-user', 'journey.update.own'),
  ('role-user', 'journey.delete.own'),
  ('role-user', 'journey.import.own'),
  ('role-user', 'journey.export.own'),
  ('role-user', 'journey.passengers.manage.own'),
  ('role-user', 'journey.share.own'),
  ('role-user', 'users.directory.read'),
  ('role-administrator', 'journey.read.any'),
  ('role-administrator', 'journey.create.any'),
  ('role-administrator', 'journey.update.any'),
  ('role-administrator', 'journey.delete.any'),
  ('role-administrator', 'journey.import.any'),
  ('role-administrator', 'journey.export.any'),
  ('role-administrator', 'journey.passengers.manage.any'),
  ('role-administrator', 'journey.share.own'),
  ('role-administrator', 'users.directory.read'),
  ('role-administrator', 'users.create'),
  ('role-administrator', 'users.update'),
  ('role-administrator', 'users.delete'),
  ('role-administrator', 'users.roles.assign'),
  ('role-administrator', 'data.stations.manage'),
  ('role-administrator', 'data.trains.manage'),
  ('role-administrator', 'data.operators.manage'),
  ('role-administrator', 'custom_fields.manage'),
  ('role-administrator', 'instance.oauth.manage'),
  ('role-administrator', 'instance.map.manage'),
  ('role-administrator', 'instance.release.check');

INSERT INTO "authorization_settings" ("id", "default_role_id")
VALUES (1, 'role-user');

-- The single application settings row. Settings that are missing are filled
-- with their defaults the first time the app starts.
INSERT INTO "app_config" ("config") VALUES ('{}');
