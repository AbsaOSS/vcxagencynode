/**
 * Copyright 2020 ABSA Group Limited
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict'

const { Pool, Client } = require('pg')
const logger = require('../../logging/logger-builder')(__filename)
const { buildStoredMessage } = require('./store-util')
const sleep = require('sleep-promise')

function _canConnectToPostgres ({ user, password, host, port }) {
  const client = new Client({ host, port, user, password })
  return new Promise((resolve, reject) => {
    client.connect(err => {
      if (err) {
        resolve(false)
      } else {
        client.end()
        resolve(true)
      }
    })
  })
}

async function waitUntilConnectsToPostgres (appStorageConfig, attemptsThreshold = 10, timeoutMs = 2000) {
  let attempts = 0
  while (true) {
    if (await _canConnectToPostgres(appStorageConfig)) {
      return
    }
    attempts += 1
    if (attempts > attemptsThreshold) {
      throw Error(`Couldn't connect to postgres after ${attemptsThreshold} attempts.`)
    }
    logger.warn(`Couldn't connect to postgres, will try again after ${timeoutMs}ms.`)
    await sleep(timeoutMs)
  }
}

/**
 * Creates object for custom storage read/writes in following areas:
 * - entity records: (minimal set of data to create AO (AccessObject) for an Entity
 * - messages: encrypted messages received by agent connection entities.
 * - agents: information about agent entities (ie. webhook_url)
 * - agent_connections: links together tuple (agentDid, agentConnectionDid, userPwDid)
 */
async function createPgStorageEntities (appStorageConfig) {
  const { user, password, host, port, database } = appStorageConfig
  const pgConfig = {
    user,
    password,
    host,
    port,
    database
  }
  const pgPool = new Pool(pgConfig)

  async function runDbQuery (query) {
    try {
      await pgPool.query(query)
    } catch (err) {
      logger.error(`Error running query ${query}: Error ${JSON.stringify(err)}`)
    }
  }

  // entity_verkey, entity_did are indexed per unique() constraint
  const createEntityRecordTable = `CREATE TABLE IF NOT EXISTS entities (
         id SERIAL  PRIMARY KEY,
         entity_did VARCHAR (50),
         entity_verkey  VARCHAR (50), 
         entity_record json NOT NULL,
         UNIQUE(entity_did),
         UNIQUE(entity_verkey)
        );
    `

  const createMessagesTable = `CREATE TABLE IF NOT EXISTS messages (
         id SERIAL PRIMARY KEY,
         agent_did VARCHAR (50),
         agent_connection_did VARCHAR (50),
         uid VARCHAR (50),
         status_code VARCHAR (50),
         payload bytea
        );
    `

  const createAgentsTable = `CREATE TABLE IF NOT EXISTS agents (
         agent_did VARCHAR (50) PRIMARY KEY,
         webhook_url VARCHAR (512),
         has_new_message BOOL
        );
    `

  const createAgentConnectionsTable = `CREATE TABLE IF NOT EXISTS agent_connections (
         agent_connection_did VARCHAR (50) PRIMARY KEY,
         user_pw_did VARCHAR (50),
         agent_did VARCHAR (50)
        );
    `

  const msgsAgentIndex = 'CREATE INDEX IF NOT EXISTS messages_agent_did ON messages (agent_did);'
  const msgsAgentAgetConnectionIndex = 'CREATE INDEX IF NOT EXISTS messages_agent_did_agent_conn_did ON messages (agent_did, agent_connection_did);'

  await runDbQuery(createEntityRecordTable)
  await runDbQuery(createMessagesTable)
  await runDbQuery(createAgentsTable)
  await runDbQuery(createAgentConnectionsTable)
  await runDbQuery(msgsAgentIndex)
  await runDbQuery(msgsAgentAgetConnectionIndex)

  // ---- ---- ---- ---- ---- ----  Agent webhooks
  async function createAgentRecord (agentDid) {
    const values = [agentDid, null, null]
    const insertQuery = 'INSERT INTO agents (agent_did, webhook_url, has_new_message) VALUES($1, $2, $3)'
    await pgPool.query(insertQuery, values)
  }

  async function setAgentWebhook (agentDid, webhookUrl) {
    const values = [agentDid, webhookUrl]
    const insertQuery = 'INSERT INTO agents (agent_did, webhook_url) VALUES($1, $2) ON CONFLICT (agent_did) DO UPDATE SET webhook_url = $2'
    await pgPool.query(insertQuery, values)
  }

  async function getAgentWebhook (agentDid) {
    const insertQuery = 'SELECT * from agents WHERE agent_did = $1'
    const values = [agentDid]
    const { rows } = await pgPool.query(insertQuery, values)
    if (rows.length > 1) {
      throw Error('Expected to find at most 1 entity.')
    }
    if (rows.length === 0) {
      return undefined
    }
    return rows[0].webhook_url
  }

  /**
   * Gets has_new_message flag of agent
   * @param {string} agentDid - DID of the agent.
   */
  async function getHasNewMessage (agentDid) {
    const insertQuery = 'SELECT has_new_message FROM agents WHERE agent_did = $1'
    const values = [agentDid]
    const { rows } = await pgPool.query(insertQuery, values)
    if (rows.length > 1) {
      throw Error('Expected to find at most 1 entity.')
    }
    if (rows.length === 0) {
      throw Error(`Expected to get 1 result row. Agent ${agentDid} seem not to exist.`)
    }
    return rows[0].has_new_message
  }

  /**
   * Updates has_new_message flag of agent
   * @param {string} agentDid - DID of the agent.
   * @param {bool} hasNewMessages - flag signalling whether new messages has been received since last "new-message probe"
   */
  async function setHasNewMessage (agentDid, hasNewMessages) {
    if (!agentDid) {
      throw Error('AgentDid or AgentConnDid was not specified.')
    }
    const values = [agentDid, hasNewMessages]
    const updateStatusQuery = 'UPDATE agents SET has_new_message = $2 WHERE agent_did = $1'
    await pgPool.query(updateStatusQuery, values)
  }

  // ---- ---- ---- ---- ---- ----  Messages read/write

  /**
   * Stores message received by agentConnection
   */
  async function storeMessage (agentDid, agentConnectionDid, uid, statusCode, dataObject) {
    const insertQuery = 'INSERT INTO messages (agent_did, agent_connection_did, uid, status_code, payload) VALUES($1, $2, $3, $4, $5) RETURNING *;'
    const values = [agentDid, agentConnectionDid, uid, statusCode, Buffer.from(JSON.stringify(dataObject))]
    await pgPool.query(insertQuery, values)
  }

  function assureValidFilter (filter) {
    if (!filter) {
      filter = []
    } else if (typeof filter === 'string') {
      filter = [filter]
    }
    return filter
  }

  /**
   * Retrieves messages belonging to particular cloud agent according to specified filters.
   * @param {string} agentDid - DID of the agent.
   * @param {array} filterAgentConnDids - filters messages by agent connection did. Empty array disables filter.
   * @param {array} filterUids - filters messages by message uids. Empty array disables filter.
   * @param {array} filterStatusCodes - filters messages by its status codes. Empty array disables filter.
   */
  async function loadMessages (agentDid, filterAgentConnDids, filterUids, filterStatusCodes) {
    filterAgentConnDids = assureValidFilter(filterAgentConnDids)
    filterUids = assureValidFilter(filterUids)
    filterStatusCodes = assureValidFilter(filterStatusCodes)
    let insertQuery = 'SELECT * from messages WHERE agent_did = $1'
    const values = [agentDid]
    if (filterAgentConnDids.length > 0) {
      values.push(filterAgentConnDids)
      insertQuery += ` AND agent_connection_did = ANY($${values.length})`
    }
    if (filterUids.length > 0) {
      values.push(filterUids)
      insertQuery += ` AND uid = ANY($${values.length})`
    }
    if (filterStatusCodes.length > 0) {
      values.push(filterStatusCodes)
      insertQuery += ` AND status_code = ANY($${values.length})`
    }
    const { rows } = await pgPool.query(insertQuery, values)
    return rows.map(row => buildStoredMessage(row.agent_did, row.agent_connection_did, row.uid, row.status_code, JSON.parse(row.payload.toString())))
  }

  /**
   * Updates statusCodes for messages on particular agent and its particular connection.
   * @param {string} agentDid - DID of the agent.
   * @param {string} agentConnDid - DID of the agent connection. Must belong to agent.
   * @param {array} uids - list of message UIDs for whom new status should be set.
   * @param {string} newStatusCode - New status code to be set for matched messages.
   */
  async function updateStatusCodeAgentConnection (agentDid, agentConnDid, uids, newStatusCode) {
    if (!agentDid || !agentConnDid) {
      throw Error('AgentDid or AgentConnDid was not specified.')
    }
    // todo: before we run actual update, we should port: see dummy's check_if_message_status_can_be_updated
    // see: https://github.com/hyperledger/indy-sdk/blob/d3057f1e21f01768104ca129de63a15d1b5e302e/vcx/dummy-cloud-agent/src/actors/agent_connection.rs
    // But Dummy Cloud Agency throws error if a single message in the set cannot be updated which seems like
    // a strange behaviour. Rather the uid should rather be just included in failedUids portion of response?
    // dummy cloud agency always return empty array for failed uids
    const values = [newStatusCode, agentDid, uids]
    const updateStatusQuery = 'UPDATE messages SET status_code = $1 WHERE agent_did = $2 AND uid = ANY($3) RETURNING uid;'
    const updateRes = await pgPool.query(updateStatusQuery, values)
    const updatedUids = updateRes.rows.map(row => row.uid)
    const failedUids = uids.filter(uid => updatedUids.includes(uid) === false)
    return { failedUids, updatedUids }
  }

  /**
   * Updates statusCodes for messages on particular agent across many connections.
   * @param {string} agentDid - DID of agent message belongs to
   * @param {string} statusCode - New status code to be set for matched messages.
   * @param {array} uidsByAgentConnDids - example: [{"aconnDid":"6FRuB95abcmzz1nURoHyWE","uids":["Br4CoNP4TU"]}, ...]
   */
  async function updateStatusCodes (agentDid, uidsByAgentConnDids, statusCode) {
    const failed = []
    const updated = []
    for (const uidsByConn of uidsByAgentConnDids) {
      const { agentConnDid, uids } = uidsByConn
      const { failedUids, updatedUids } = await updateStatusCodeAgentConnection(agentDid, agentConnDid, uids, statusCode)
      if (failedUids.length > 0) {
        failed.push({ agentConnDid, uids: failedUids })
      }
      if (updatedUids.length > 0) {
        updated.push({ agentConnDid, uids: updatedUids })
      }
    }
    return { failed, updated }
  }

  // ---- ---- ---- ---- ---- ----  Entity records read/write

  /**
   * Loads "Entity Record". This is data necessary to recreate entity's AO (Access Object) to manipulate it.
   * @param {string} entityDidOrVerkey - DID or Verkey of an entity
   * @return {object|undefined} Entity record belonging to the entity with specified DID/Verkey.
   * Undefined if DID/Verkey is not matching any entity's DID/Verkey.
   */
  async function loadEntityRecordByDidOrVerkey (entityDidOrVerkey) {
    const insertQuery = 'SELECT * from entities WHERE entity_did = $1 OR entity_verkey = $1'
    const values = [entityDidOrVerkey]
    const { rows } = await pgPool.query(insertQuery, values)
    if (rows.length > 1) {
      throw Error('Expected to find at most 1 entity.')
    }
    return rows[0].entity_record
  }

  /**
   * Loads "Entity Record". This is data necessary to recreate entity's AO (Access Object) to manipulate it.
   * @param {string} entityDid - DID of an entity
   * @return {object|undefined} Entity record belonging to the entity with specified DID.
   * Undefined if DID is not matching any entity's DID.
   */
  async function loadEntityRecordByDid (entityDid) {
    const insertQuery = 'SELECT * from entities WHERE entity_did = $1'
    const values = [entityDid]
    const { rows } = await pgPool.query(insertQuery, values)
    if (rows.length > 1) {
      throw Error('Expected to find at most 1 entity.')
    }
    return rows[0].entity_record
  }

  /**
   * Stores "Entity Record" into storage.
   * @param {string} entityDid - DID of an entity
   * @param {string} entityVerkey - Verkey of an entity
   * @param {object} entityRecord - The "entity record", can have arbitrary structure. It's responsibility of the
   * reader to properly interpret an entity record.
   */
  async function saveEntityRecord (entityDid, entityVerkey, entityRecord) {
    const insertQuery = 'INSERT INTO entities (entity_did, entity_verkey, entity_record) VALUES($1, $2, $3) RETURNING *;'
    const values = [entityDid, entityVerkey, entityRecord]
    await pgPool.query(insertQuery, values)
  }

  // ---- ---- ---- ---- ---- ----  Agent 2 AgentConn links

  /**
   * Creates records linking together tuple of (agent_did, agent_connection_did, user_pairwise_did)
   * @param {string} agentDid - DID of an Agent owning connection
   * @param {string} agentConnDid - Verkey of an entity
   * @param {object} userPwDid - The "entity record", can have arbitrary structure
   */
  async function linkAgentToItsConnection (agentDid, agentConnDid, userPwDid) {
    const insertQuery = 'INSERT INTO agent_connections (agent_connection_did, user_pw_did, agent_did) VALUES($1, $2, $3)'
    const values = [agentConnDid, userPwDid, agentDid]
    await pgPool.query(insertQuery, values)
  }

  /**
   * Returns all link records for particular Agent
   * @param {string} agentDid - DID of an Agent owning connection
   */
  async function getAgentLinks (agentDid) {
    const insertQuery = 'SELECT * from agent_connections WHERE agent_did = $1'
    const values = [agentDid]
    const { rows } = await pgPool.query(insertQuery, values)
    return rows.map(row => {
      return { agentConnDid: row.agent_connection_did, userPwDid: row.user_pw_did }
    }
    )
  }

  /**
   * For Agent's connection, converts "User Pairwise Did" into "Agent Connection Did"
   * @param {string} agentDid - DID of an Agent owning connection
   * @param {string} pwDid - "User Pairwise DID" associated with the connection
   */
  async function pwDidToAconnDid (agentDid, pwDid) {
    const res = await aconnLinkPairsByPwDids(agentDid, [pwDid])
    if (res.length === 0) {
      return undefined
    }
    return res[0].agentConnDid
  }

  /**
   * For Agent's connection, converts "Agent Connection Did" into "User Pairwise Did"
   * @param {string} agentDid - DID of an Agent owning connection
   * @param {string} aconnDid - "User Pairwise DID" associated with the connection
   */
  async function aconnDidToPwDid (agentDid, aconnDid) {
    const res = await aconnLinkPairsByAconnDids(agentDid, [aconnDid])
    if (res.length === 0) {
      return undefined
    }
    return res[0].userPwDid
  }

  /**
   * Returns list of tuples ( "Agent Connection Did", "User pairwise Did"), each representing one connection.
   * @param {string} agentDid - DID of an Agent owning the connection.
   * @param {array} filterUserPwDids - Filters records by "User Pairwise DIDs". Empty array disables filter.
   */
  async function aconnLinkPairsByPwDids (agentDid, filterUserPwDids) {
    const aconnLinks = await getAgentLinks(agentDid)
    const pairs = []
    for (const aconnLink of aconnLinks) {
      const { userPwDid } = aconnLink
      if (filterUserPwDids.length === 0 || filterUserPwDids.includes(userPwDid)) {
        const { agentConnDid } = aconnLink
        pairs.push({ agentConnDid, userPwDid })
      }
    }
    return pairs
  }

  /**
   * Returns list of tuples ( "Agent Connection Did", "User pairwise Did"), each representing one connection.
   * @param {string} agentDid - DID of an Agent owning the connection.
   * @param {array} filterAgentConnDids - Filters records by "Agent Connection DIDs". Empty array disables filter.
   */
  async function aconnLinkPairsByAconnDids (agentDid, filterAgentConnDids) {
    const aconnLinks = await getAgentLinks(agentDid)
    const pairs = []
    for (const aconnLink of aconnLinks) {
      const { agentConnDid } = aconnLink
      if (filterAgentConnDids.length === 0 || filterAgentConnDids.includes(agentConnDid)) {
        const { userPwDid } = aconnLink
        pairs.push({ agentConnDid, userPwDid })
      }
    }
    return pairs
  }

  /**
   * Maps updateByConn by pwDid to updateByConn  by agentConnDid.
   * Example: maps [{"pairwiseDID":"12346543AAAAEFGHRoHyWE","uids":["Br4CoNP4TU"]}] to [{"agentConnDid":"6FRuB95abcmzz1nURoHyWE","uids":["Br4CoNP4TU"]}]
   * @param {string} agentDid - DID of an Agent owning connection
   * @param {array} uidsByUserPwDids - updateByConn by pwDid
   * If one of the agent connection DIDs cannot be mapped into pairwiseDID, the update record will be omitted in response
   */
  async function convertIntoStorageRequest (agentDid, uidsByUserPwDids) {
    const res = []
    for (const uidsByUserPwDid of uidsByUserPwDids) {
      const { pairwiseDID, uids } = uidsByUserPwDid
      const mapped = await aconnLinkPairsByPwDids(agentDid, [pairwiseDID])
      if (mapped.length === 1) {
        const { agentConnDid } = mapped[0]
        res.push({ agentConnDid, uids })
      }
    }
    return res
  }

  /**
   * Maps updateByConn by agentConnDid to updateByConn by pwDid.
   * Example: maps [{"agentConnDid":"6FRuB95abcmzz1nURoHyWE","uids":["Br4CoNP4TU"]}] to [{"pairwiseDID":"12346543AAAAEFGHRoHyWE","uids":["Br4CoNP4TU"]}]
   * @param {string} agentDid - DID of an Agent owning connection
   * @param {array} uidsByUserAgentConnDids - updateByConn by agent connection DIDs
   * If one of the agent connection DIDs cannot be mapped into pairwiseDID, the update record will be omitted in response
   */
  async function convertIntoUserUpdateResponse (agentDid, uidsByUserAgentConnDids) {
    const res = []
    for (const uidsByAgentConnDid of uidsByUserAgentConnDids) {
      const { agentConnDid, uids } = uidsByAgentConnDid
      const mapped = await aconnLinkPairsByAconnDids(agentDid, [agentConnDid])
      if (mapped.length === 1) {
        const { userPwDid: pairwiseDID } = mapped[0]
        res.push({ pairwiseDID, uids })
      }
    }
    return res
  }

  function cleanUp () {
    pgPool.end()
  }

  return {
    // entity records
    loadEntityRecordByDid,
    loadEntityRecordByDidOrVerkey,
    saveEntityRecord,

    // messaging
    updateStatusCodes,
    storeMessage,
    loadMessages,

    // webhook storage
    createAgentRecord,
    setAgentWebhook,
    getAgentWebhook,

    // agent - agentConnection links
    linkAgentToItsConnection,
    aconnLinkPairsByPwDids,
    aconnLinkPairsByAconnDids,
    convertIntoStorageRequest,
    convertIntoUserUpdateResponse,
    pwDidToAconnDid,
    aconnDidToPwDid,

    setHasNewMessage,
    getHasNewMessage,

    cleanUp
  }
}

module.exports = {
  createPgStorageEntities,
  waitUntilConnectsToPostgres
}
