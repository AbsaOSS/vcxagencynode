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
const { vcxFlowCreateAgentConnection, vcxFlowFullOnboarding, vcxFlowCreateAgent, vcxFlowSignUp, vcxFlowConnect } = require('vcxagency-client')
const { indyCreateWallet, indyCreateAndStoreMyDid, indyOpenWallet, indyGenerateWalletKey } = require('easy-indysdk')
const uuid = require('uuid')
const rimraf = require('rimraf')
const os = require('os')
const { createTestPgDb } = require('../../pg-tmpdb')
const { setupVcxLogging } = require('../../utils')
const { wireUpApplication, cleanUpApplication } = require('../../../src/app')
const { buildAgencyClientVirtual } = require('./common')

const agencyWalletName = `vcxagency-node-${uuid.v4()}`
const agencyDid = 'VsKV7grR1BUE29mG2Fm2kX'
const agencySeed = '0000000000000000000000000Forward'
const agencyWalletKey = '@key'
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379/0'

let app
let agencyUserWalletName
let agencyUserWalletKey
let agencyUserDid
let agencyUserVerkey
let agencyUserWh

let bobWalletName
let bobWalletKey
let bobVerkey
let bobWh

const WALLET_KDF = 'RAW'

let agencyVerkey
let sendToAgency
let tmpPgDb

beforeAll(async () => {
  jest.setTimeout(1000 * 120)
  if (process.env.ENABLE_VCX_LOGS) {
    setupVcxLogging()
  }
  tmpPgDb = await createTestPgDb()
  app = await wireUpApplication(tmpPgDb.info, REDIS_URL, agencyWalletName, agencyDid, agencySeed, agencyWalletKey)
  const entityForwardAgent = app.entityForwardAgent
  const agencyClient = await buildAgencyClientVirtual(entityForwardAgent)
  sendToAgency = agencyClient.sendToAgency
  const agencyInfo = await agencyClient.getAgencyInfo()
  agencyVerkey = agencyInfo.verkey
})

afterAll(async () => {
  cleanUpApplication(app)
})

beforeEach(async () => {
  {
    agencyUserWalletKey = await indyGenerateWalletKey()
    agencyUserWalletName = `unit-test-${uuid.v4()}`
    await indyCreateWallet(agencyUserWalletName, agencyUserWalletKey, WALLET_KDF)
    agencyUserWh = await indyOpenWallet(agencyUserWalletName, agencyUserWalletKey, WALLET_KDF)
    const { did, vkey } = await indyCreateAndStoreMyDid(agencyUserWh)
    agencyUserDid = did
    agencyUserVerkey = vkey
  }
  {
    bobWalletKey = await indyGenerateWalletKey()
    bobWalletName = `unit-test-${uuid.v4()}`
    await indyCreateWallet(bobWalletName, bobWalletKey, WALLET_KDF)
    bobWh = await indyOpenWallet(bobWalletName, bobWalletKey, WALLET_KDF)
    const { vkey } = await indyCreateAndStoreMyDid(bobWh)
    bobVerkey = vkey
  }
})

afterEach(async () => {
  const homedir = os.homedir()
  const clientWalletPath = `${homedir}/.indy_client/wallet/${agencyUserWalletName}`
  const attackerWalletPath = `${homedir}/.indy_client/wallet/${bobWalletName}`
  await rimraf.sync(clientWalletPath)
  await rimraf.sync(attackerWalletPath)
})

describe('onboarding', () => {
  it('forward agent should authdecrypt "Connect" message and respond with "Connected"', async () => {
    // act
    const msgConnected = await vcxFlowConnect(agencyUserWh, sendToAgency, agencyDid, agencyVerkey, agencyUserDid, agencyUserVerkey)

    // assert
    expect(msgConnected.withPairwiseDID).toBeDefined()
    expect(msgConnected.withPairwiseDIDVerKey).toBeDefined()
    expect(msgConnected['@type']).toBe('did:sov:123456789abcdefghi1234;spec/onboarding/1.0/CONNECTED')
  })

  it('agent should send "SignUp" and get response "SignedUp"', async () => {
    // arrange
    const msgConnected = await vcxFlowConnect(agencyUserWh, sendToAgency, agencyDid, agencyVerkey, agencyUserDid, agencyUserVerkey)
    const tmpAgentDid = msgConnected.withPairwiseDID
    const tmpAgentVerkey = msgConnected.withPairwiseDIDVerKey

    // act
    const msgSingedUp = await vcxFlowSignUp(agencyUserWh, sendToAgency, tmpAgentDid, tmpAgentVerkey, agencyUserVerkey)

    // assert
    expect(msgSingedUp['@type']).toBe('did:sov:123456789abcdefghi1234;spec/onboarding/1.0/SIGNED_UP')
  })

  it('should throw authorization error if signUp message is sent from different verkey (attacker Bob)', async () => {
    // arrange
    const msgConnected = await vcxFlowConnect(agencyUserWh, sendToAgency, agencyDid, agencyVerkey, agencyUserDid, agencyUserVerkey)
    const tmpAgentDid = msgConnected.withPairwiseDID
    const tmpAgentVerkey = msgConnected.withPairwiseDIDVerKey

    // act
    let thrown
    try {
      await vcxFlowSignUp(bobWh, sendToAgency, tmpAgentDid, tmpAgentVerkey, bobVerkey)
    } catch (err) {
      thrown = err
    }

    // assert
    expect(thrown.message).toMatch(/not authorized/i)
  })

  it('should finalize onboarding by sending CreateAgent and get back AgentCreated', async () => {
    // arrange
    const msgConnected = await vcxFlowConnect(agencyUserWh, sendToAgency, agencyDid, agencyVerkey, agencyUserDid, agencyUserVerkey)
    const tmpAgentDid = msgConnected.withPairwiseDID
    const tmpAgentVerkey = msgConnected.withPairwiseDIDVerKey
    await vcxFlowSignUp(agencyUserWh, sendToAgency, tmpAgentDid, tmpAgentVerkey, agencyUserVerkey)

    // act
    const msgAgentCreated = await vcxFlowCreateAgent(agencyUserWh, sendToAgency, tmpAgentDid, tmpAgentVerkey, agencyUserVerkey)

    // assert
    expect(msgAgentCreated['@type']).toBe('did:sov:123456789abcdefghi1234;spec/onboarding/1.0/AGENT_CREATED')
    expect(msgAgentCreated.withPairwiseDID).toBeDefined()
    expect(msgAgentCreated.withPairwiseDIDVerKey).toBeDefined()
  })

  it('should create agent, then create Agent connection - send CreateKey and get KeyCreated message back', async () => {
    // arrange
    const { agentDid, agentVerkey } = await vcxFlowFullOnboarding(agencyUserWh, sendToAgency, agencyDid, agencyVerkey, agencyUserDid, agencyUserVerkey)
    const { did: userPairwiseDid, vkey: userPairwiseVerkey } = await indyCreateAndStoreMyDid(agencyUserWh)

    // act
    const msgKeyCreated = await vcxFlowCreateAgentConnection(agencyUserWh, sendToAgency, agentDid, agentVerkey, agencyUserVerkey, userPairwiseDid, userPairwiseVerkey)

    // assert
    const agentConnectionDid = msgKeyCreated.withPairwiseDID
    const agentConnectionVerkey = msgKeyCreated.withPairwiseDIDVerKey
    expect(agentConnectionDid).toBeDefined()
    expect(agentConnectionVerkey).toBeDefined()
  })
})
