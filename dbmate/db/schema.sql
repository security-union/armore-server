SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;


--
-- Name: EXTENSION "uuid-ossp"; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';


--
-- Name: accesstype; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.accesstype AS ENUM (
    'Permanent',
    'EmergencyOnly'
);


--
-- Name: appstate; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.appstate AS ENUM (
    'Foreground',
    'Background',
    'UNKNOWN'
);


--
-- Name: chargingstate; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.chargingstate AS ENUM (
    'ChargingUsb',
    'ChargingAc',
    'NotCharging',
    'UNKNOWN'
);


--
-- Name: command; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.command AS ENUM (
    'RefreshTelemetry'
);


--
-- Name: commandstate; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.commandstate AS ENUM (
    'Created',
    'Completed',
    'Error'
);


--
-- Name: crudaction; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.crudaction AS ENUM (
    'Insert',
    'Update',
    'Delete'
);


--
-- Name: invitation_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.invitation_status AS ENUM (
    'created',
    'accepted',
    'rejected',
    'canceled'
);


--
-- Name: invitation_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.invitation_type AS ENUM (
    'follower',
    'device'
);


--
-- Name: link_invitation_state; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.link_invitation_state AS ENUM (
    'CREATED',
    'ACCEPTED',
    'REJECTED',
    'EXPIRED'
);


--
-- Name: locationpermissionstate; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.locationpermissionstate AS ENUM (
    'ALWAYS',
    'USING',
    'ASK',
    'NEVER',
    'UNKNOWN'
);


--
-- Name: os; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.os AS ENUM (
    'Android',
    'iOS',
    'UNKNOWN'
);


--
-- Name: user_and_follower; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.user_and_follower AS (
	username character varying(255),
	username_follower character varying(255)
);


--
-- Name: users_to_migrate_2; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.users_to_migrate_2 AS (
	username character varying(255)
);


--
-- Name: userstate; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.userstate AS ENUM (
    'Normal',
    'Emergency'
);


--
-- Name: add_friend(character varying, character varying); Type: PROCEDURE; Schema: public; Owner: -
--

CREATE PROCEDURE public.add_friend(usernamea character varying, usernameb character varying)
    LANGUAGE sql
    AS $$
INSERT INTO users_followers(username, username_follower, access_type, is_emergency_contact)
    VALUES (usernameA, usernameB, 'Permanent', true);
INSERT INTO users_followers_state(username, username_follower)
    VALUES (usernameA, usernameB);
INSERT INTO users_followers(username, username_follower, access_type, is_emergency_contact)
    VALUES (usernameB, usernameA, 'Permanent', true);
INSERT INTO users_followers_state(username, username_follower)
    VALUES (usernameB, usernameA);
$$;


--
-- Name: device_history(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.device_history() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    BEGIN
        INSERT INTO device_settings SELECT NEW.*;
        RETURN NULL;
    END;
$$;


--
-- Name: follow_user(character varying, character varying); Type: PROCEDURE; Schema: public; Owner: -
--

CREATE PROCEDURE public.follow_user(usernamea character varying, username_followera character varying)
    LANGUAGE sql
    AS $$
INSERT INTO users_followers(username, username_follower, access_type, is_emergency_contact)
    VALUES (usernameA, username_followerA, 'Permanent', true);
INSERT INTO users_followers_state(username, username_follower)
    VALUES (usernameA, username_followerA);
$$;


--
-- Name: migrate_users_to_users_access(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.migrate_users_to_users_access() RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
strs user_and_follower;
BEGIN
 FOR strs IN
     (SELECT username, username_follower FROM public.return_users_devices_that_require_migration())
     LOOP
     INSERT INTO users_followers (username, username_follower, access_type, is_emergency_contact) VALUES (strs.username, strs.username_follower, 'Permanent', true);
     INSERT INTO users_followers_state (username, username_follower, follower_perception) VALUES (strs.username, strs.username_follower, 'Normal');
 end loop;
 END;

$$;


--
-- Name: migrate_users_to_users_settings_and_users_state(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.migrate_users_to_users_settings_and_users_state() RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
strs users_to_migrate_2;
BEGIN
 FOR strs IN
     (SELECT username FROM public.return_users_that_require_migration())
     LOOP
     INSERT INTO users_settings (username, followers_to_declare_emergency) VALUES (strs.username, 2);
     INSERT INTO users_state (username, self_perception) VALUES (strs.username, 'Normal');
 end loop;
 END;

$$;


--
-- Name: remove_friend(character varying, character varying); Type: PROCEDURE; Schema: public; Owner: -
--

CREATE PROCEDURE public.remove_friend(usernamea character varying, usernameb character varying)
    LANGUAGE sql
    AS $$
DELETE FROM users_followers
    WHERE username IN (usernameA, usernameB) AND username_follower IN (usernameA, usernameB);
DELETE FROM users_followers_state
    WHERE username IN (usernameA, usernameB) AND username_follower IN (usernameA, usernameB);
$$;


--
-- Name: return_users_devices_that_require_migration(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.return_users_devices_that_require_migration() RETURNS SETOF public.user_and_follower
    LANGUAGE plpgsql
    AS $$
declare
    rec user_and_follower;
BEGIN
    for rec in
        SELECT derived.username, derived.username_follower FROM (
              SELECT DISTINCT ud2.username, ud1.username AS username_follower
              FROM users_devices AS ud1
                       INNER JOIN users_devices AS ud2
                                  ON ud1.device_id = ud2.device_id and ud1.owner = false and ud2.owner = true
                  EXCEPT
              SELECT username, username_follower
              from users_followers
        ) as derived
    loop
        return next rec;
    end loop;
END;
$$;


--
-- Name: return_users_that_require_migration(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.return_users_that_require_migration() RETURNS SETOF public.users_to_migrate_2
    LANGUAGE plpgsql
    AS $$
declare
    rec users_to_migrate_2;
BEGIN
    for rec in
        SELECT derived.username FROM (
            SELECT username from users
                EXCEPT
            SELECT username
            from users_settings
        ) as derived
    loop
        return next rec;
    end loop;
END;
$$;


--
-- Name: unidirectional_to_bidirectional(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.unidirectional_to_bidirectional() RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
    f RECORD;
BEGIN
    FOR f IN SELECT username_follower, username FROM users_followers AS unidirectional_friends
        EXCEPT
        SELECT uf1.username_follower, uf1.username
        FROM users_followers AS uf1
            RIGHT JOIN users_followers AS uf2 ON uf1.username=uf2.username_follower
    LOOP
        CALL follow_user(f.username_follower, f.username);
    END LOOP;
END;
$$;


--
-- Name: users_state_history(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.users_state_history() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    BEGIN
        INSERT INTO users_state_history SELECT NEW.username, NEW.self_perception;
        RETURN NULL;
    END;
$$;


SET default_tablespace = '';

--
-- Name: command_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.command_log (
    username character varying(255),
    device_id character varying(255),
    request text,
    request_timestamp timestamp without time zone,
    response text,
    response_timestamp timestamp without time zone,
    correlation_id character varying(255)
);


--
-- Name: commands; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.commands (
    username character varying(255) NOT NULL,
    recipient_username character varying(255),
    request text,
    request_timestamp timestamp without time zone NOT NULL,
    response text,
    response_timestamp timestamp without time zone,
    correlation_id character varying(255),
    type public.command NOT NULL,
    state public.commandstate NOT NULL
);


--
-- Name: device_geofence; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.device_geofence (
    geofence_id integer NOT NULL,
    device_id character varying(255) NOT NULL,
    active boolean NOT NULL,
    update_timestamp timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: device_geofence_geofence_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.device_geofence_geofence_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: device_geofence_geofence_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.device_geofence_geofence_id_seq OWNED BY public.device_geofence.geofence_id;


--
-- Name: device_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.device_settings (
    device_id character varying(255) NOT NULL,
    role character varying(255) NOT NULL,
    name character varying(255) NOT NULL,
    os public.os,
    os_version character varying(50),
    model character varying(50),
    push_token character varying(255),
    app_version character varying(255),
    location_permission_state public.locationpermissionstate DEFAULT 'UNKNOWN'::public.locationpermissionstate NOT NULL,
    is_notifications_enabled boolean,
    is_background_refresh_on boolean,
    is_location_services_on boolean,
    is_power_save_mode_on boolean,
    creation_timestamp timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: device_telemetry; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.device_telemetry (
    username character varying(255) NOT NULL,
    recipient_username character varying(255) NOT NULL,
    encrypted_location text NOT NULL,
    device_id character varying(255) NOT NULL,
    creation_timestamp timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    app_state public.appstate DEFAULT 'UNKNOWN'::public.appstate NOT NULL,
    charging_state public.chargingstate DEFAULT 'UNKNOWN'::public.chargingstate NOT NULL,
    battery_level double precision DEFAULT 0 NOT NULL,
    is_charging boolean DEFAULT false NOT NULL
);


--
-- Name: devices; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.devices (
    device_id character varying(255) NOT NULL,
    role character varying(255) NOT NULL,
    name character varying(255) NOT NULL,
    os public.os DEFAULT 'UNKNOWN'::public.os,
    os_version character varying(50) DEFAULT 'UNKNOWN'::character varying,
    model character varying(50) DEFAULT 'UNKNOWN'::character varying,
    push_token character varying(255),
    app_version character varying(255),
    location_permission_state public.locationpermissionstate DEFAULT 'UNKNOWN'::public.locationpermissionstate NOT NULL,
    is_notifications_enabled boolean,
    is_background_refresh_on boolean,
    is_location_services_on boolean,
    is_power_save_mode_on boolean
);


--
-- Name: geofences; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.geofences (
    geofence_id integer NOT NULL,
    lat double precision NOT NULL,
    lon double precision NOT NULL,
    radius smallint NOT NULL,
    name character varying(255) DEFAULT 'PRIVATE'::character varying NOT NULL,
    address character varying(255) DEFAULT 'PRIVATE'::character varying NOT NULL,
    username character varying(255) DEFAULT 'PRIVATE'::character varying NOT NULL
);


--
-- Name: geofences_geofence_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.geofences_geofence_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: geofences_geofence_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.geofences_geofence_id_seq OWNED BY public.geofences.geofence_id;


--
-- Name: invitations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.invitations (
    id uuid NOT NULL,
    creator_username character varying(255),
    target_username character varying(255),
    status public.invitation_status NOT NULL,
    invitation jsonb NOT NULL,
    type public.invitation_type NOT NULL,
    creation_timestamp timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    update_timestamp timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    target_email character varying(255),
    target_phone_number character varying(25)
);


--
-- Name: link_invitations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.link_invitations (
    id character varying(255) NOT NULL,
    state public.link_invitation_state DEFAULT 'CREATED'::public.link_invitation_state NOT NULL,
    creation_timestamp timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    expiration_timestamp timestamp without time zone NOT NULL,
    creator_username character varying(255) NOT NULL,
    recipient_username character varying(255) DEFAULT NULL::character varying
);


--
-- Name: schema_migrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.schema_migrations (
    version character varying(255) NOT NULL
);


--
-- Name: user_details; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_details (
    username character varying(255) NOT NULL,
    first_name character varying(255) NOT NULL,
    last_name character varying(255) NOT NULL,
    picture character varying(255),
    creation_timestamp timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_timestamp timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    language character varying(50) DEFAULT 'en'::character varying NOT NULL
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    username character varying(255) NOT NULL,
    email character varying(255),
    phone_number character varying(25),
    CONSTRAINT phone_or_email_constraint CHECK (((phone_number IS NOT NULL) OR (email IS NOT NULL)))
);


--
-- Name: users_devices; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users_devices (
    username character varying(255) NOT NULL,
    device_id character varying(255) NOT NULL,
    owner boolean NOT NULL,
    access_enabled boolean NOT NULL,
    permissions jsonb
);


--
-- Name: users_followers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users_followers (
    username character varying(255) NOT NULL,
    username_follower character varying(255) NOT NULL,
    access_type public.accesstype DEFAULT 'EmergencyOnly'::public.accesstype NOT NULL,
    is_emergency_contact boolean DEFAULT false NOT NULL,
    creation_timestamp timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    update_timestamp timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: users_followers_state; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users_followers_state (
    username character varying(255) NOT NULL,
    username_follower character varying(255) NOT NULL,
    follower_perception public.userstate DEFAULT 'Normal'::public.userstate NOT NULL,
    creation_timestamp timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    update_timestamp timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: users_geofences; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users_geofences (
    geofence_id integer NOT NULL,
    username character varying(255) NOT NULL
);


--
-- Name: users_geofences_geofence_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.users_geofences_geofence_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: users_geofences_geofence_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.users_geofences_geofence_id_seq OWNED BY public.users_geofences.geofence_id;


--
-- Name: users_identity; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users_identity (
    username character varying(255) NOT NULL,
    public_key text NOT NULL,
    creation_timestamp timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    update_timestamp timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: users_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users_settings (
    username character varying(255) NOT NULL,
    followers_to_declare_emergency smallint DEFAULT 2 NOT NULL,
    creation_timestamp timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    update_timestamp timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: users_state; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users_state (
    username character varying(255) NOT NULL,
    self_perception public.userstate DEFAULT 'Normal'::public.userstate NOT NULL,
    creation_timestamp timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    update_timestamp timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: users_state_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users_state_history (
    username character varying(255) NOT NULL,
    self_perception public.userstate DEFAULT 'Normal'::public.userstate NOT NULL,
    creation_timestamp timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: users_verification; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users_verification (
    verification_id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    verification_code character(5) NOT NULL,
    email character varying(255),
    used boolean NOT NULL,
    creation_timestamp timestamp without time zone NOT NULL,
    updated_timestamp timestamp without time zone NOT NULL,
    expiration_timestamp timestamp without time zone NOT NULL,
    public_key text DEFAULT ''::text NOT NULL,
    phone_number character varying(25) DEFAULT NULL::character varying,
    CONSTRAINT phone_or_email_constraint CHECK (((phone_number IS NOT NULL) OR (email IS NOT NULL)))
);


--
-- Name: device_geofence geofence_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.device_geofence ALTER COLUMN geofence_id SET DEFAULT nextval('public.device_geofence_geofence_id_seq'::regclass);


--
-- Name: geofences geofence_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.geofences ALTER COLUMN geofence_id SET DEFAULT nextval('public.geofences_geofence_id_seq'::regclass);


--
-- Name: users_geofences geofence_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users_geofences ALTER COLUMN geofence_id SET DEFAULT nextval('public.users_geofences_geofence_id_seq'::regclass);


--
-- Name: device_geofence device_geofence_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.device_geofence
    ADD CONSTRAINT device_geofence_pkey PRIMARY KEY (geofence_id, device_id);


--
-- Name: device_settings device_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.device_settings
    ADD CONSTRAINT device_settings_pkey PRIMARY KEY (device_id, creation_timestamp);


--
-- Name: devices devices_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.devices
    ADD CONSTRAINT devices_pkey PRIMARY KEY (device_id);


--
-- Name: geofences geofences_geofence_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.geofences
    ADD CONSTRAINT geofences_geofence_id_key UNIQUE (geofence_id);


--
-- Name: invitations invitations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invitations
    ADD CONSTRAINT invitations_pkey PRIMARY KEY (id);


--
-- Name: link_invitations link_invitations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.link_invitations
    ADD CONSTRAINT link_invitations_pkey PRIMARY KEY (id);


--
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (version);


--
-- Name: users_devices unique_device_id; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users_devices
    ADD CONSTRAINT unique_device_id UNIQUE (device_id);


--
-- Name: user_details user_details_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_details
    ADD CONSTRAINT user_details_pkey PRIMARY KEY (username);


--
-- Name: users_devices users_devices_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users_devices
    ADD CONSTRAINT users_devices_pkey PRIMARY KEY (username, device_id);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users_followers users_followers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users_followers
    ADD CONSTRAINT users_followers_pkey PRIMARY KEY (username, username_follower);


--
-- Name: users_followers_state users_followers_state_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users_followers_state
    ADD CONSTRAINT users_followers_state_pkey PRIMARY KEY (username, username_follower);


--
-- Name: users_geofences users_geofences_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users_geofences
    ADD CONSTRAINT users_geofences_pkey PRIMARY KEY (geofence_id, username);


--
-- Name: users_identity users_identity_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users_identity
    ADD CONSTRAINT users_identity_pkey PRIMARY KEY (username);


--
-- Name: users users_phone_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_phone_number_key UNIQUE (phone_number);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (username);


--
-- Name: users_settings users_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users_settings
    ADD CONSTRAINT users_settings_pkey PRIMARY KEY (username);


--
-- Name: users_state_history users_state_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users_state_history
    ADD CONSTRAINT users_state_history_pkey PRIMARY KEY (username, creation_timestamp);


--
-- Name: users_state users_state_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users_state
    ADD CONSTRAINT users_state_pkey PRIMARY KEY (username);


--
-- Name: users_verification users_verification_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users_verification
    ADD CONSTRAINT users_verification_pkey PRIMARY KEY (verification_id);


--
-- Name: device_telemetry_timestamp_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX device_telemetry_timestamp_idx ON public.device_telemetry USING btree (creation_timestamp);


--
-- Name: devices device_history; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER device_history AFTER INSERT OR UPDATE ON public.devices FOR EACH ROW EXECUTE PROCEDURE public.device_history();


--
-- Name: users_state users_state_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER users_state_trigger AFTER INSERT OR UPDATE ON public.users_state FOR EACH ROW EXECUTE PROCEDURE public.users_state_history();


--
-- Name: device_geofence device_geofence_device_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.device_geofence
    ADD CONSTRAINT device_geofence_device_id_fkey FOREIGN KEY (device_id) REFERENCES public.devices(device_id) ON DELETE CASCADE;


--
-- Name: device_geofence device_geofence_geofence_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.device_geofence
    ADD CONSTRAINT device_geofence_geofence_id_fkey FOREIGN KEY (geofence_id) REFERENCES public.geofences(geofence_id) ON DELETE CASCADE;


--
-- Name: device_telemetry device_telemetry_username_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.device_telemetry
    ADD CONSTRAINT device_telemetry_username_fkey FOREIGN KEY (username) REFERENCES public.users(username) ON DELETE CASCADE;


--
-- Name: device_settings fk_device; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.device_settings
    ADD CONSTRAINT fk_device FOREIGN KEY (device_id) REFERENCES public.devices(device_id) ON DELETE CASCADE;


--
-- Name: users_geofences fk_geofence_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users_geofences
    ADD CONSTRAINT fk_geofence_id FOREIGN KEY (geofence_id) REFERENCES public.geofences(geofence_id) ON DELETE CASCADE;


--
-- Name: devices fk_users_devices_device_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.devices
    ADD CONSTRAINT fk_users_devices_device_id FOREIGN KEY (device_id) REFERENCES public.users_devices(device_id) ON DELETE CASCADE;


--
-- Name: users_state_history fk_users_state; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users_state_history
    ADD CONSTRAINT fk_users_state FOREIGN KEY (username) REFERENCES public.users_state(username) ON DELETE CASCADE;


--
-- Name: invitations invitations_creator_username_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invitations
    ADD CONSTRAINT invitations_creator_username_fkey FOREIGN KEY (creator_username) REFERENCES public.users(username) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: invitations invitations_target_username_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invitations
    ADD CONSTRAINT invitations_target_username_fkey FOREIGN KEY (target_username) REFERENCES public.users(username) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: link_invitations link_invitations_creator_username_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.link_invitations
    ADD CONSTRAINT link_invitations_creator_username_fkey FOREIGN KEY (creator_username) REFERENCES public.users(username) ON DELETE CASCADE;


--
-- Name: link_invitations link_invitations_recipient_username_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.link_invitations
    ADD CONSTRAINT link_invitations_recipient_username_fkey FOREIGN KEY (recipient_username) REFERENCES public.users(username) ON DELETE CASCADE;


--
-- Name: user_details user_details_target_username_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_details
    ADD CONSTRAINT user_details_target_username_fkey FOREIGN KEY (username) REFERENCES public.users(username) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: users_devices users_devices_target_username_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users_devices
    ADD CONSTRAINT users_devices_target_username_fkey FOREIGN KEY (username) REFERENCES public.users(username) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: users_followers_state users_followers_state_username_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users_followers_state
    ADD CONSTRAINT users_followers_state_username_fkey FOREIGN KEY (username, username_follower) REFERENCES public.users_followers(username, username_follower) ON DELETE CASCADE;


--
-- Name: users_followers users_followers_username_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users_followers
    ADD CONSTRAINT users_followers_username_fkey FOREIGN KEY (username) REFERENCES public.users(username) ON DELETE CASCADE;


--
-- Name: users_followers users_followers_username_follower_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users_followers
    ADD CONSTRAINT users_followers_username_follower_fkey FOREIGN KEY (username_follower) REFERENCES public.users(username) ON DELETE CASCADE;


--
-- Name: users_identity users_identity_username_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users_identity
    ADD CONSTRAINT users_identity_username_fkey FOREIGN KEY (username) REFERENCES public.users(username) ON DELETE CASCADE;


--
-- Name: users_settings users_settings_username_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users_settings
    ADD CONSTRAINT users_settings_username_fkey FOREIGN KEY (username) REFERENCES public.users(username) ON DELETE CASCADE;


--
-- Name: users_state users_state_username_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users_state
    ADD CONSTRAINT users_state_username_fkey FOREIGN KEY (username) REFERENCES public.users(username) ON DELETE CASCADE;


--
-- Name: users_verification users_verification_email_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users_verification
    ADD CONSTRAINT users_verification_email_fkey FOREIGN KEY (email) REFERENCES public.users(email) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--


--
-- Dbmate schema migrations
--

INSERT INTO public.schema_migrations (version) VALUES
    ('20151129054053'),
    ('20151129054054'),
    ('20151129054055'),
    ('20151129054056'),
    ('20151129054059'),
    ('20151129054060'),
    ('20151129054061'),
    ('20151129054062'),
    ('20151129054063'),
    ('20151129054064'),
    ('20151129054065'),
    ('20151129054066'),
    ('20151129054067'),
    ('20151129054068'),
    ('20151129054069'),
    ('20151129054070'),
    ('20151129054071'),
    ('20151129054072'),
    ('20151129054073'),
    ('20151129054074'),
    ('20151129054075'),
    ('20200209154800'),
    ('20200209154801'),
    ('20200209154802'),
    ('20200209154803'),
    ('20200209202641'),
    ('20200212001251'),
    ('20200215211342'),
    ('20200225211342'),
    ('20200301211342'),
    ('20200414211342'),
    ('20200418211342'),
    ('20200418211349'),
    ('20200419091342'),
    ('20200419211349'),
    ('20200419211350'),
    ('20200427081342'),
    ('20200427091342'),
    ('20200505091342'),
    ('20200521211342'),
    ('20200525091342'),
    ('20200526211342'),
    ('20200604091342'),
    ('20200606091342'),
    ('20200608091342'),
    ('20200609211342'),
    ('20200628133108'),
    ('20200629223804'),
    ('20200701133108'),
    ('20200701233108'),
    ('20200717001251'),
    ('20200724001251'),
    ('20200724181251'),
    ('20200724181252'),
    ('20201101010926'),
    ('20201101011058'),
    ('20201104055657'),
    ('20201201220557'),
    ('20201203230943'),
    ('20201204200302'),
    ('20201208004535'),
    ('20210105150805'),
    ('20210117221453'),
    ('20210130172100');
