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

"use strict"

/* eslint-env jest */
const { createStorageMemory } = require('../tools/storage/storage-mem')
const { getGenesisFile } = require('../tools/network-registry')
const { basicVcxInit } = require('../tools/vcx-easy-lite/init')
const { updateConnection } = require('../tools/vcx-easy-lite/flows-connection')
const { createOrRetrieveConnection } = require('../tools/vcx-easy-lite/flows-connection')
const { createOrRetrieveConnectionInvite } = require('../tools/vcx-easy-lite/flows-connection')
const { fetchAgencyDidVkey } = require('../tools/vcx-easy-lite/agent-provision-utils')
const { indyGenerateWalletKey } = require('easy-indysdk')
const { createAgentProvision } = require('../tools/vcx-easy-lite/agent-provision-utils')
const logger = require('../tools/logger')(__filename)
const { initVcxAgentClient } = require('../tools/vcx-easy-lite/init')
const sleep = require('sleep-promise')
const { messageSend } = require('../tools/vcx-easy-lite/flows-message')
const { messagesGetForPwDid } = require('../tools/vcx-easy-lite/flows-message')

beforeAll(async () => {
  jest.setTimeout(1000 * 60 * 4)

  const VCX_LOG_LEVEL = process.env.VCX_LOG_LEVEL || 'debug'
  await basicVcxInit(VCX_LOG_LEVEL)
})

let utime
let faberId
let faberSeed
let aliceId
let aliceSeed
let connectionIdAtAlice
let connectionIdAtFaber
let genesisPath
let agencyDid
let agencyVerkey

const walletKdf = 'RAW'
let walletKey
const stepDelayMs = 1

const NETWORK = process.env.NETWORK || 'builder-net'
const agencyEndpoint = process.env.AGENCY || 'http://localhost:8080'
const logoUrl = 'http://logo.url/123.png'

beforeAll(async () => {
  walletKey = await indyGenerateWalletKey()
  genesisPath = getGenesisFile(NETWORK)
  if (!agencyDid || !agencyVerkey) {
    const res = await fetchAgencyDidVkey(`${agencyEndpoint}/agency`)
    agencyDid = res.agencyDid
    agencyVerkey = res.agencyVerkey
  }
})

beforeEach(async () => {
  utime = Math.floor(new Date() / 1000)
  faberId = `vcx-easy-test-faber-${utime}`
  faberSeed = '000000000000000000000000Trustee1'
  aliceId = `vcx-easy-test-alice-${utime}`
  aliceSeed = '000000000000000000000000Alice000'
  connectionIdAtAlice = `${aliceId}-to-${faberId}`
  connectionIdAtFaber = `${faberId}-to-${aliceId}`
})

describe('onboarding', () => {
  it('should exchange messages between alice and faber', async () => {
    const aliceConnections = await createStorageMemory()
    const faberConnections = await createStorageMemory()
    logger.info('Going to Alice agent.')
    await sleep(stepDelayMs)
    const aliceAgentProvision =
      await createAgentProvision(aliceId, aliceSeed, agencyEndpoint, genesisPath, aliceId, logoUrl, agencyDid, agencyVerkey, walletKdf, walletKey)

    logger.info('Going to Faber agent.')
    await sleep(stepDelayMs)
    const faberAgentProvision =
      await createAgentProvision(faberId, faberSeed, agencyEndpoint, genesisPath, faberId, logoUrl, agencyDid, agencyVerkey, walletKdf, walletKey)

    logger.info('Going to initialize VCX with Alice agent provision.')
    await sleep(stepDelayMs)
    const aliceVcxControl = await initVcxAgentClient(aliceAgentProvision)

    await aliceVcxControl.shutdownVcxCallable()

    logger.info('Going to initialize VCX with Faber agent provision.')
    await sleep(stepDelayMs)
    const faberVcxControl = await initVcxAgentClient(faberAgentProvision)

    logger.info('Faber is going to generate invite')
    await sleep(stepDelayMs)
    const invite = await createOrRetrieveConnectionInvite(faberConnections, connectionIdAtFaber)
    logger.info(`Faber generated invite:\n${invite}`)
    await sleep(stepDelayMs)
    await faberVcxControl.shutdownVcxCallable()

    await aliceVcxControl.initVcxCallable()
    logger.info('Alice is going to establish connection with Faber')
    await sleep(stepDelayMs)
    await createOrRetrieveConnection(aliceConnections, connectionIdAtAlice, () => invite)
    await aliceVcxControl.shutdownVcxCallable()

    await faberVcxControl.initVcxCallable()
    logger.info('Faber is going to update connection')
    await sleep(stepDelayMs)
    let connectionAtFaber = await updateConnection(faberConnections, connectionIdAtFaber)
    const serConnectionAtFaber = await connectionAtFaber.serialize()
    logger.info(`serConnectionAtFaber=${JSON.stringify(serConnectionAtFaber)}`)
    await faberVcxControl.shutdownVcxCallable()

    await aliceVcxControl.initVcxCallable()
    logger.info('Alice is going to confirm to ack the connection')
    const connectionAtAlice = await updateConnection(aliceConnections, connectionIdAtAlice)
    const serConnectionAtAlice = await connectionAtAlice.serialize()
    const messagesAtAlice = await messagesGetForPwDid(serConnectionAtAlice.data.pw_did, [], ['MS-106'], [])
    console.log(JSON.stringify(messagesAtAlice))
    expect(messagesAtAlice.length).toBe(1)

    logger.info('Alice is going to send a custom message to Faber')
    await messageSend(connectionAtAlice, 'hello foo', 'foo', 'title-foo')
    await aliceVcxControl.shutdownVcxCallable()

    await faberVcxControl.initVcxCallable()
    logger.info('Faber is going to check for ack to complete connection')
    await updateConnection(faberConnections, connectionIdAtFaber)
    logger.info('Faber is going to check for custom message sent by Alice')
    const unreadMessagesAtFaber = await messagesGetForPwDid(serConnectionAtFaber.data.pw_did, [], ['MS-103'], [])
    expect(unreadMessagesAtFaber.length).toBe(1)
    const unreadMessageAtFaber = JSON.parse(unreadMessagesAtFaber[0].decryptedPayload)
    expect(JSON.parse(unreadMessageAtFaber['@msg']).content).toBe('hello foo')
  })
})
