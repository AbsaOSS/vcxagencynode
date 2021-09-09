CREATE TABLE entities (
    id SERIAL  PRIMARY KEY,
    entity_did VARCHAR (50),
    entity_verkey  VARCHAR (50),
    entity_record json NOT NULL,
    UNIQUE(entity_did),
    UNIQUE(entity_verkey)
);

CREATE TABLE messages (
    id SERIAL PRIMARY KEY,
    agent_did VARCHAR (50),
    agent_connection_did VARCHAR (50),
    uid VARCHAR (50),
    status_code VARCHAR (50),
    payload BLOB
);

CREATE TABLE agents (
    agent_did VARCHAR (50) PRIMARY KEY,
    webhook_url VARCHAR (512),
    has_new_message BOOL
);

CREATE TABLE agent_connections (
    agent_connection_did VARCHAR (50) PRIMARY KEY,
    user_pw_did VARCHAR (50),
    agent_did VARCHAR (50)
);
