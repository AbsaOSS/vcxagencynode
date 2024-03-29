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

const mysql = require('mysql')
const logger = require('../../logging/logger-builder')(__filename)
const { buildStoredMessage } = require('./storage-utils')
const sleep = require('sleep-promise')
const util = require('util')
const { canConnectToDbSchema } = require('dbutils')
const { timeOperation } = require('../util')

async function waitUntilConnectsToMysql (user, password, host, port, schema, attemptsThreshold = 10, timeoutMs = 10000) {
  let attempts = 0
  while (true) {
    if (await canConnectToDbSchema(user, password, host, port, schema)) {
      return
    }
    attempts += 1
    if (attempts > attemptsThreshold) {
      throw Error(`Couldn't connect to mysql after ${attemptsThreshold} attempts.`)
    }
    logger.warn(`Couldn't connect to mysql, will try again after ${timeoutMs}ms.`)
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
async function createDataStorage (appStorageConfig) {
  const { user, password, host, port, database } = appStorageConfig
  const pool = mysql.createPool({
    connectionLimit: 50,
    host,
    port,
    user,
    password,
    database
  })

  const queryDb = util.promisify(pool.query).bind(pool)

  function explainQuery (query, values, logValues) {
    logValues = logValues || values
    queryDb(`EXPLAIN ${query}`, values)
      .catch(err => {
        logger.error(`Failed to execute EXPLAIN mysql query, err: ${err.stack}`)
      })
      .then(explanation => {
        logger.info(`Query explained; query: ${query}, values: ${logValues}, explanation: ${JSON.stringify(explanation)}`)
      })
  }

  // ---- ---- ---- ---- ---- ----  Agent webhooks
  async function createAgentRecord (agentDid) {
    const values = [agentDid, null, null]
    const query = 'INSERT INTO agents (agent_did, webhook_url, has_new_message) VALUES(?, ?, ?)'
    if (global.EXPLAIN_QUERIES) { explainQuery(query, values) }
    return timeOperation(queryDb, { query, values, opName: 'createAgentRecord' }, query, values)
  }

  async function setAgentWebhook (agentDid, webhookUrl) {
    const values = [agentDid, webhookUrl, webhookUrl]
    const query = 'INSERT INTO agents (agent_did, webhook_url) VALUES(?, ?) ON DUPLICATE KEY UPDATE webhook_url = ?'
    if (global.EXPLAIN_QUERIES) { explainQuery(query, values) }
    return timeOperation(queryDb, { query, values, opName: 'setAgentWebhook' }, query, values)
  }

  async function getAgentWebhook (agentDid) {
    const query = 'SELECT * from agents WHERE agent_did = ?'
    const values = [agentDid]
    if (global.EXPLAIN_QUERIES) { explainQuery(query, values) }
    const rows = await timeOperation(queryDb, { query, values, opName: 'getAgentWebhook' }, query, values)
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
    const query = 'SELECT has_new_message FROM agents WHERE agent_did = ?'
    const values = [agentDid]
    if (global.EXPLAIN_QUERIES) { explainQuery(query, values) }
    const rows = await timeOperation(queryDb, { query, values, opName: 'getHasNewMessage' }, query, values)
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
    const values = [hasNewMessages, agentDid]
    const query = 'UPDATE agents SET has_new_message = ? WHERE agent_did = ?'
    if (global.EXPLAIN_QUERIES) { explainQuery(query, values) }
    await timeOperation(queryDb, { query, values, opName: 'setHasNewMessage' }, query, values)
  }

  // ---- ---- ---- ---- ---- ----  Messages read/write

  /**
   * Stores message received by agentConnection
   */
  async function storeMessage (agentDid, agentConnectionDid, uid, statusCode, dataObject) {
    const query = 'INSERT INTO messages (agent_did, agent_connection_did, uid, status_code, payload) VALUES(?, ?, ?, ?, ?);'
    const dataBuffer = Buffer.from(JSON.stringify(dataObject))
    const values = [agentDid, agentConnectionDid, uid, statusCode, dataBuffer]
    const logValues = [agentDid, agentConnectionDid, uid, statusCode, `data of ${dataBuffer.byteLength} bytes`]
    if (global.EXPLAIN_QUERIES) { explainQuery(query, values, logValues) }
    await timeOperation(queryDb, { query, values: logValues, opName: 'storeMessage' }, query, values)
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
    let query = 'SELECT * from messages WHERE agent_did = ?'
    const values = [agentDid]
    if (filterUids.length > 0) {
      values.push(filterUids)
      query += ' AND uid IN(?)'
    }
    if (filterAgentConnDids.length > 0) {
      values.push(filterAgentConnDids)
      query += ' AND agent_connection_did IN(?)'
    }
    if (filterStatusCodes.length > 0) {
      values.push(filterStatusCodes)
      query += ' AND status_code IN(?)'
    }
    if (global.EXPLAIN_QUERIES) { explainQuery(query, values) }
    const rows = await timeOperation(queryDb, { query, values, opName: 'loadMessages' }, query, values)
    return rows.map(row => buildStoredMessage(row.agent_did, row.agent_connection_did, row.uid, row.status_code, JSON.parse(row.payload.toString())))
  }

  /**
   * Updates statusCodes for messages on particular agent and its particular connection.
   * @param {string} agentDid - DID of the agent.
   * @param {array} uids - list of message UIDs for whom new status should be set.
   * @param {string} newStatusCode - New status code to be set for matched messages.
   */
  async function updateStatusCodeAgentConnection (agentDid, uids, newStatusCode) {
    if (!agentDid) {
      throw Error(`Failed to update status codes for messages ${uids}: AgentDid was not specified.`)
    }
    if (uids.length === 0) {
      return
    }
    const values = [newStatusCode, agentDid, uids]
    const query = 'UPDATE messages SET status_code = ? WHERE agent_did = ? AND uid IN(?)'
    if (global.EXPLAIN_QUERIES) { explainQuery(query, values) }
    await timeOperation(queryDb, { query, values, opName: 'updateStatusCodeAgentConnection' }, query, values)
  }

  // ---- ---- ---- ---- ---- ----  Entity records read/write

  /**
   * Loads "Entity Record". This is data necessary to recreate entity's AO (Access Object) to manipulate it.
   * @param {string} entityDidOrVerkey - DID or Verkey of an entity
   * @return {object|undefined} Entity record belonging to the entity with specified DID/Verkey.
   * Undefined if DID/Verkey is not matching any entity's DID/Verkey.
   */
  async function loadEntityRecordByDidOrVerkey (entityDidOrVerkey) {
    const query = 'SELECT * from entities WHERE entity_did = ? OR entity_verkey = ?'
    const values = [entityDidOrVerkey, entityDidOrVerkey]
    if (global.EXPLAIN_QUERIES) { explainQuery(query, values) }
    const rows = await timeOperation(queryDb, { query, values, opName: 'loadEntityRecordByDidOrVerkey' }, query, values)
    if (rows.length > 1) {
      throw Error('Expected to find at most 1 entity.')
    }
    return JSON.parse(rows[0].entity_record)
  }

  /**
   * Loads "Entity Record". This is data necessary to recreate entity's AO (Access Object) to manipulate it.
   * @param {string} entityDid - DID of an entity
   * @return {object|undefined} Entity record belonging to the entity with specified DID.
   * Undefined if DID is not matching any entity's DID.
   */
  async function loadEntityRecordByDid (entityDid) {
    const query = 'SELECT * from entities WHERE entity_did = ?'
    const values = [entityDid]
    if (global.EXPLAIN_QUERIES) { explainQuery(query, values) }
    const rows = await timeOperation(queryDb, { query, values, opName: 'loadEntityRecordByDid' }, query, values)
    if (rows.length > 1) {
      throw Error('Expected to find at most 1 entity.')
    }
    return JSON.parse(rows[0].entity_record)
  }

  /**
   * Stores "Entity Record" into storage.
   * @param {string} entityDid - DID of an entity
   * @param {string} entityVerkey - Verkey of an entity
   * @param {object} entityRecord - The "entity record", can have arbitrary structure. It's responsibility of the
   * reader to properly interpret an entity record.
   */
  async function saveEntityRecord (entityDid, entityVerkey, entityRecord) {
    // const insertQuery = 'INSERT INTO entities (entity_did, entity_verkey, entity_record) VALUES(?, ?, ?) RETURNING *;'
    const query = 'INSERT INTO entities (entity_did, entity_verkey, entity_record) VALUES(?, ?, ?);'
    const values = [entityDid, entityVerkey, JSON.stringify(entityRecord)]
    const logValues = [entityDid, entityVerkey, 'utf8-data']
    if (global.EXPLAIN_QUERIES) { explainQuery(query, logValues) }
    await timeOperation(queryDb, { query, values: logValues, opName: 'saveEntityRecord' }, query, values)
  }

  // ---- ---- ---- ---- ---- ----  Agent 2 AgentConn links

  /**
   * Creates records linking together tuple of (agent_did, agent_connection_did, user_pairwise_did)
   * @param {string} agentDid - DID of an Agent owning connection
   * @param {string} agentConnDid - Verkey of an entity
   * @param {object} userPwDid - The "entity record", can have arbitrary structure
   */
  async function linkAgentToItsConnection (agentDid, agentConnDid, userPwDid) {
    const query = 'INSERT INTO agent_connections (agent_connection_did, user_pw_did, agent_did) VALUES(?, ?, ?)'
    const values = [agentConnDid, userPwDid, agentDid]
    if (global.EXPLAIN_QUERIES) { explainQuery(query, values) }
    await timeOperation(queryDb, { query, values, opName: 'linkAgentToItsConnection' }, query, values)
  }

  /**
   * Returns all link records for particular Agent
   * @param {string} agentDid - DID of an Agent owning connection
   */
  async function getAgentLinks (agentDid) {
    const query = 'SELECT * from agent_connections WHERE agent_did = ?'
    const values = [agentDid]
    if (global.EXPLAIN_QUERIES) { explainQuery(query, values) }
    const rows = await timeOperation(queryDb, { query, values, opName: 'getAgentLinks' }, query, values)
    return rows.map(row => {
      return { agentConnDid: row.agent_connection_did, userPwDid: row.user_pw_did }
    }
    )
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

  function cleanUp () {
    pool.end()
  }

  return {
    // entity records
    loadEntityRecordByDid,
    loadEntityRecordByDidOrVerkey,
    saveEntityRecord,

    // messaging
    updateStatusCodeAgentConnection,
    storeMessage,
    loadMessages,

    // webhook storage
    createAgentRecord,
    setAgentWebhook,
    getAgentWebhook,

    // agent - agentConnection links
    linkAgentToItsConnection,
    aconnLinkPairsByAconnDids,

    setHasNewMessage,
    getHasNewMessage,

    cleanUp
  }
}

module.exports = {
  createDataStorage,
  waitUntilConnectsToMysql
}
