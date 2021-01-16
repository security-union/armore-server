-- migrate:up
ALTER TYPE invitation_type ADD VALUE 'follower' BEFORE 'device';


-- migrate:down
DROP TYPE invitation_type;
CREATE TYPE invitation_type AS ENUM ('device');
