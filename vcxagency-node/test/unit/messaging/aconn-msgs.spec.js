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
const {
  vcxFlowGetMsgsFromAgentConn,
  vcxFlowCreateAgentConnection,
  vcxFlowFullOnboarding
} = require('vcxagency-client')
const { indyCreateWallet, indyCreateAndStoreMyDid, indyOpenWallet, indyGenerateWalletKey } = require('easy-indysdk')
const uuid = require('uuid')
const rimraf = require('rimraf')
const os = require('os')
const { wireUpApplication, cleanUpApplication } = require('../../../src/app')
const { createTestPgDb } = require('../../pg-tmpdb')
const { setupVcxLogging } = require('../../utils')
const { buildAgencyClientVirtual } = require('./common')

const agencyWalletName = `vcxagency-node-${uuid.v4()}`
const agencyDid = 'VsKV7grR1BUE29mG2Fm2kX'
const agencySeed = '0000000000000000000000000Forward'
const agencyWalletKey = '@key'

let application
let serviceIndyWallets // eslint-disable-line
let entityForwardAgent // eslint-disable-line
let serviceStorage // eslint-disable-line
let resolver // eslint-disable-line
let router // eslint-disable-line
let agencyVerkey // eslint-disable-line

let agencyUserWalletName
let agencyUserWalletKey
let agencyUserDid
let agencyUserVerkey
let agencyUserWh

const WALLET_KDF = 'RAW'
let sendToAgency
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379/0'

let tmpPgDb
beforeAll(async () => {
  jest.setTimeout(1000 * 120)
  if (process.env.ENABLE_VCX_LOGS) {
    setupVcxLogging()
  }
  tmpPgDb = await createTestPgDb()
  application = await wireUpApplication(tmpPgDb.info, REDIS_URL, agencyWalletName, agencyDid, agencySeed, agencyWalletKey)
  serviceIndyWallets = application.serviceIndyWallets
  entityForwardAgent = application.entityForwardAgent
  serviceStorage = application.serviceStorage
  resolver = application.resolver
  router = application.router

  const agencyClient = await buildAgencyClientVirtual(entityForwardAgent)
  sendToAgency = agencyClient.sendToAgency
  const agencyInfo = await agencyClient.getAgencyInfo()
  agencyVerkey = agencyInfo.verkey
})

afterAll(async () => {
  cleanUpApplication(application)
//   await tmpPgDb.dropDb()
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

  const { agentDid: aDid1, agentVerkey: aVerkey1 } = await vcxFlowFullOnboarding(agencyUserWh, sendToAgency, agencyDid, agencyVerkey, agencyUserDid, agencyUserVerkey)
  agent1Did = aDid1
  agent1Verkey = aVerkey1
  const { did: userPairwiseDid, vkey: userPairwiseVerkey } = await indyCreateAndStoreMyDid(agencyUserWh)
  aconnUserPwVkey = userPairwiseVerkey
  const msgKeyCreated = await vcxFlowCreateAgentConnection(agencyUserWh, sendToAgency, agent1Did, agent1Verkey, agencyUserVerkey, userPairwiseDid, aconnUserPwVkey)
  aconnDid = msgKeyCreated.withPairwiseDID
  aconnVerkey = msgKeyCreated.withPairwiseDIDVerKey
  const otherConnectionDid = '3zM5TyH1Cgq5gg8wGFitXS'
  await serviceStorage.storeMessage(agent1Did, aconnDid, msg1Id, 'MS-103', { msg: 'hello' })
  await serviceStorage.storeMessage(agent1Did, aconnDid, msg2Id, 'MS-103', { msg: 'annyeong' })
  await serviceStorage.storeMessage(agent1Did, aconnDid, msg3Id, 'MS-104', { msg: 'bonjour' })
  await serviceStorage.storeMessage(agent1Did, otherConnectionDid, msg4Id, 'MS-103', { msg: 'ahoj' })
})

afterEach(async () => {
  const homedir = os.homedir()
  const clientWalletPath = `${homedir}/.indy_client/wallet/${agencyUserWalletName}`
  await rimraf.sync(clientWalletPath)
})

let aconnDid
let aconnVerkey
let aconnUserPwVkey

const msg1Id = uuid.v4()
const msg2Id = uuid.v4()
const msg3Id = uuid.v4()
const msg4Id = uuid.v4()

let agent1Did
let agent1Verkey

describe('message download from agent connection', () => {
  it('should filter messages by status', async () => {
    // arrange
    // act & assert 1, filter by status
    const msgReply = await vcxFlowGetMsgsFromAgentConn(agencyUserWh, sendToAgency, aconnDid, aconnVerkey, aconnUserPwVkey, ['MS-103'], [])
    expect(msgReply['@type']).toBe('did:sov:123456789abcdefghi1234;spec/pairwise/1.0/MSGS')
    const { msgs } = msgReply
    expect(Array.isArray(msgs)).toBeTruthy()
    expect(msgs.length).toBe(2)

    const msg1 = msgs.find(msg => msg.uid === msg1Id)
    expect(msg1).toBeDefined()
    expect(msg1.statusCode).toBe('MS-103')
    expect(msg1.payload.msg).toBe('hello')

    const msg2 = msgs.find(msg => msg.uid === msg2Id)
    expect(msg2).toBeDefined()
    expect(msg2.statusCode).toBe('MS-103')
    expect(msg2.payload.msg).toBe('annyeong')
  })

  it('should get all messages', async () => {
    const msgReply = await vcxFlowGetMsgsFromAgentConn(agencyUserWh, sendToAgency, aconnDid, aconnVerkey, aconnUserPwVkey, [], [])
    expect(msgReply['@type']).toBe('did:sov:123456789abcdefghi1234;spec/pairwise/1.0/MSGS')
    const { msgs } = msgReply
    expect(msgs.length).toBe(3)

    const msgs3 = msgs.find(msg => msg.uid === msg3Id)
    expect(msgs3).toBeDefined()
    expect(msgs3.statusCode).toBe('MS-104')
    expect(msgs3.payload.msg).toBe('bonjour')
  })

  it('should filter messages by uid', async () => {
    const msgReply = await vcxFlowGetMsgsFromAgentConn(agencyUserWh, sendToAgency, aconnDid, aconnVerkey, aconnUserPwVkey, [], [msg2Id])
    expect(msgReply['@type']).toBe('did:sov:123456789abcdefghi1234;spec/pairwise/1.0/MSGS')
    const { msgs } = msgReply
    expect(msgs.length).toBe(1)

    const msg2 = msgs.find(msg => msg.uid === msg2Id)
    expect(msg2).toBeDefined()
    expect(msg2.payload.msg).toBe('annyeong')
  })
})
