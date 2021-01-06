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
const { getGenesisFile } = require('../tools/network-registry')
const { initRustapi } = require('@hyperledger/vcxagent-core')
const axios = require('axios')
const logger = require('../tools/logger')(__filename)
const sleep = require('sleep-promise')
const { createVcxAgent } = require('@hyperledger/vcxagent-core')

beforeAll(async () => {
  jest.setTimeout(1000 * 60 * 4)
  await initRustapi(process.env.VCX_LOG_LEVEL || 'vcx=error,agency_client=error')
})

let utime
let genesisPath
let faberId
let aliceId
let connectionIdAtAlice
let connectionIdAtFaber
let agencyDid
let agencyVerkey

// const walletKdf = 'RAW'
// const walletKey = "8dvfYSt5d1taSd6yJdpjq4emkwsPDDLYxkNFysFD2cZY"
const stepDelayMs = 1

const NETWORK = process.env.NETWORK || 'builder-net'
const agencyUrl = process.env.AGENCY || 'http://localhost:8080'

beforeAll(async () => {
  genesisPath = getGenesisFile(NETWORK)
  if (!agencyDid || !agencyVerkey) {
    const { data: res } = await axios.get(`${agencyUrl}/agency`)
    agencyDid = res.agencyDid
    agencyVerkey = res.agencyVerkey
  }
})

beforeEach(async () => {
  utime = Math.floor(new Date() / 1000)
  faberId = `vcx-easy-test-faber-${utime}`
  aliceId = `vcx-easy-test-alice-${utime}`
  connectionIdAtAlice = `${aliceId}-to-${faberId}`
  connectionIdAtFaber = `${faberId}-to-${aliceId}`
})

describe('onboarding', () => {
  it('should exchange messages between alice and faber', async () => {
    try {
      logger.info('Going to Alice agent.')
      await sleep(stepDelayMs)
      const aliceAgentConfig = {
        agentName: aliceId,
        agencyUrl,
        genesisPath,
        seed: '000000000000000000000000Alice000',
        usePostgresWallet: false,
        logger
      }
      const agentAlice = await createVcxAgent(aliceAgentConfig)
      const faberAgentConfig = {
        agentName: faberId,
        agencyUrl,
        genesisPath,
        seed: '000000000000000000000000Alice000',
        usePostgresWallet: false,
        logger
      }
      const agentFaber = await createVcxAgent(faberAgentConfig)

      await agentFaber.agentInitVcx()
      logger.info('Faber is going to generate invite')
      // const invite = await createOrRetrieveConnectionInvite(faberConnections, connectionIdAtFaber)
      const invite = await agentFaber.serviceConnections.inviterConnectionCreate(connectionIdAtFaber)
      logger.info(`Faber generated invite:\n${invite}`)
      await agentFaber.agentShutdownVcx()

      await agentAlice.agentInitVcx()
      logger.info('Alice is going to establish connection with Faber')
      await agentAlice.serviceConnections.inviteeConnectionAcceptFromInvitation(connectionIdAtAlice, invite)
      await agentAlice.agentShutdownVcx()

      await agentFaber.agentInitVcx()
      logger.info('Faber is going to update connection')
      await agentFaber.serviceConnections.connectionUpdate(connectionIdAtFaber)
      await agentFaber.agentShutdownVcx()

      await agentAlice.agentInitVcx()
      logger.info('Alice is going to confirm to ack the connection')
      await agentAlice.serviceConnections.connectionUpdate(connectionIdAtAlice)
      await agentAlice.agentShutdownVcx()

      await agentFaber.agentInitVcx()
      logger.info('Faber is going to update connection')
      await agentFaber.serviceConnections.connectionUpdate(connectionIdAtFaber)
      await agentFaber.agentShutdownVcx()

      await sleep(10)
      await agentAlice.agentInitVcx()
      const messagesAtAlice = await agentAlice.serviceConnections.getMessagesV2(connectionIdAtAlice, [], [])
      expect(messagesAtAlice.length).toBe(1)
      const messagesAtAliceReviewed = await agentAlice.serviceConnections.getMessagesV2(connectionIdAtAlice, ['MS-106'], [])
      expect(messagesAtAliceReviewed.length).toBe(1)
      expect(messagesAtAliceReviewed.find(m => m.statusCode === 'MS-106')).toBeDefined()
      logger.info('Alice is going to send a custom message to Faber')
      await agentAlice.serviceConnections.sendMessage(connectionIdAtAlice, 'hello foo')
      await agentAlice.agentShutdownVcx()

      await agentFaber.agentInitVcx()
      const unreadMessagesAtFaber = await agentFaber.serviceConnections.getMessagesV2(connectionIdAtFaber, ['MS-103'], [])
      const unreadMessageAtFaber = JSON.parse(unreadMessagesAtFaber[0].decryptedMsg)
      expect(unreadMessageAtFaber.content).toBe('hello foo')
    } catch (err) {
      logger.error(err.message)
      throw err
    } finally {
      await sleep(500) // because we are using --force-exit when running the test, we need to give some time for all logs to print out
    }
  })
})
