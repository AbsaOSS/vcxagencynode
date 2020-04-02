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

/* eslint-env jest */
const { createTestPgDb } = require('../../pg-tmpdb')
const { createPgStorageEntities } = require('../../../src/service/storage/pgstorage-entities')
const { performance } = require('perf_hooks')
const { Client } = require('pg')
const logger = require('../../tools/logger')(__filename)
const util = require('util')

beforeAll(async () => {
  jest.setTimeout(1000 * 300)
})

// by default, generate-dataset.js will generate csv file to: /tmp/agencydata/agency-messages.csv
// so if running pgsql in docker, simplest way is mount this data 1:1 like this:
// docker run --name postgres -v /tmp/agencydata/:/tmp/agencydata/ -v  pgdata:/var/lib/postgresql/data -e POSTGRES_PASSWORD=mysecretpassword -d -p 5432:5432 postgres
const importPath = process.env.IMPORT_PATH || `/tmp/agencydata/agency-messages.csv`

let storage
let pgClient
beforeAll(async () => {
  let { info } = await createTestPgDb()
  storage = await createPgStorageEntities(info)
  logger.info(`Using pgsql storage: ${JSON.stringify(info)}`)
  pgClient = new Client(info)
  await pgClient.connect()
  try {
    // Note: The import path must be reachable on system where pgsql is running, so if you run docker, this file must be
    // in the pgsql docker container.
    await pgClient.query(`COPY messages FROM '${importPath}' DELIMITER ',' CSV HEADER;`)
  } catch (err) {
    logger.error(`Error importing messages from file to table. Error: ${util.inspect(err)}`)
    process.exit(1)
  }
})

afterAll(async () => {
  await pgClient.end()
})

describe('storage', () => {
  // 10mil msgs, take 4000ms to retrieve - indexes: none
  // 10mil msgs, take   70ms to retrieve - indexes: agent_did
  // 10mil msgs, take   20ms to retrieve - indexes: agent_did, (agent_did, agent_connection_did)

  // 1mil msgs, take  101ms to retrieve - indexes: none
  // 1mil msgs, take   25ms to retrieve - indexes: agent_did
  // 1mil msgs, take   15ms to retrieve - indexes: agent_did, (agent_did, agent_connection_did)
  it('should store and retrieve messages of all agent connections', async () => {
    const { rows } = await pgClient.query(`SELECT * FROM messages where id = '123'`)
    const { agent_did, agent_connection_did, uid, status_code } = rows[0] // eslint-disable-line
    const tStart = performance.now()
    await storage.loadMessages(agent_did, [agent_connection_did], [uid], []) // eslint-disable-line
    const tFinish = performance.now()
    let durationSec = (tFinish - tStart)
    logger.info(`Duration ${durationSec}ms to retrieve agent messages by status and agent-connection.`)
  })
})
