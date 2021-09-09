CREATE INDEX messages_agent_did ON messages (agent_did);
CREATE INDEX messages_agent_did_agent_conn_did ON messages (agent_did, agent_connection_did);
