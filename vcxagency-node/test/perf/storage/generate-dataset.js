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

const uuid = require('uuid')
const fs = require('fs')
const logger = require('../../tools/logger')(__filename)
const mkdirp = require('mkdirp')

const exportPath = process.env.EXPORT_PATH || `/tmp/agencydata/agency-messages.csv`

const AGENT_CNT = 100
const CONNECTIONS_PER_AGENT = 100
const MSGS_PER_AGENT_CONNECTION = 100
const TOTAL_RECORDS = AGENT_CNT * CONNECTIONS_PER_AGENT * MSGS_PER_AGENT_CONNECTION

function * createMsgRecordsGenerator (agents, connectionsPerAgent, msgsPerAgentConnection) {
  let id = 1
  for (let i = 0; i < agents; i++) {
    const agentDid = uuid.v4()
    for (let j = 0; j < connectionsPerAgent; j++) {
      const agentConnectionDid = uuid.v4()
      for (let k = 0; k < msgsPerAgentConnection; k++) {
        id += 1
        const msgUid = uuid.v4()
        yield {
          id,
          agent_did: agentDid,
          agent_connection_did: agentConnectionDid,
          uid: msgUid,
          status_code: 'MS-103',
          payload: '\\x7b226d7367223a22613168656c6c6f31227d' // encoded { msg: 'a1hello1' }
        }
      }
    }
  }
}

async function generateCsvDirectly (csvExportPath, msgRecordGenerator) {
  return new Promise((resolve, reject) => {
    var stream = fs.createWriteStream(csvExportPath, { highWaterMark: 33554432 }) // write in 32mb chunks
    stream.once('open', async function (fd) {
      stream.write('id,agent_did,agent_connection_did,uid,status_code,payload\n')
      let line = 1
      let progressPrevious = 0
      while (true) {
        const { done, value } = msgRecordGenerator.next()
        if (done) {
          break
        }
        const progress = Math.floor((line / TOTAL_RECORDS) * 100)
        if (progressPrevious !== progress) {
          logger.info(`File hydration progress: ${progress}`)
        }
        const { id, agent_did, agent_connection_did, uid, status_code, payload } = value // eslint-disable-line
        const canContinue = stream.write(`${id},${agent_did},${agent_connection_did},${uid},${status_code},${payload}\n`) // eslint-disable-line
        if (!canContinue) {
          await new Promise(resolve => stream.once('drain', resolve))
        }
        line++
        progressPrevious = progress
      }
      stream.end()
    })
    stream.once('finish', () => {
      logger.info(`Success. File of ${TOTAL_RECORDS} created at ${csvExportPath}`)
      resolve(true)
    })
    stream.once('error', reject)
  })
}

async function run () {
  await mkdirp('/tmp/agencydata/')
  let recordGenerator = createMsgRecordsGenerator(AGENT_CNT, CONNECTIONS_PER_AGENT, MSGS_PER_AGENT_CONNECTION)
  logger.info(`Going to generate ${TOTAL_RECORDS} message records`)
  await generateCsvDirectly(exportPath, recordGenerator)
  process.exit(0)
}

run()
