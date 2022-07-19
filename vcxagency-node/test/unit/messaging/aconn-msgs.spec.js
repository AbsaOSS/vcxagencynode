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
global.LOG_LEVEL = process.env.LOG_LEVEL || 'info'
global.LOG_JSON_TO_CONSOLE = process.env.LOG_JSON_TO_CONSOLE === 'true'
global.SILENT_WINSTON = process.env.SILENT_WINSTON === 'false'

const {
  vcxFlowGetMsgsFromAgentConn,
  vcxFlowCreateAgentConnection,
  vcxFlowFullOnboarding,
  vcxFlowUpdateMsgsFromAgent
} = require('vcxagency-client')
const { indyCreateWallet, indyCreateAndStoreMyDid, indyOpenWallet, indyGenerateWalletKey } = require('easy-indysdk')
const uuid = require('uuid')
const rimraf = require('rimraf')
const os = require('os')
const { createDbSchemaWallets } = require('dbutils')
const { getBaseAppConfig } = require('./common')
const { buildApplication, cleanUpApplication } = require('../../../src/execution/app')
const { createDbSchemaApplication } = require('dbutils')
const { setupVcxLogging } = require('../../utils')
const { buildAgencyClientVirtual } = require('./common')

const agencyWalletName = `vcxagency-node-${uuid.v4()}`
const agencyDid = 'VsKV7grR1BUE29mG2Fm2kX'
const agencySeed = '0000000000000000000000000Forward'
const agencyWalletKey = '@key'

let app
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

let tmpDbData
let tmpDbWallet

let msg1Id
let msg2Id
let msg3Id
let msg4Id

function regenerateUuids () {
  msg1Id = uuid.v4()
  msg2Id = uuid.v4()
  msg3Id = uuid.v4()
  msg4Id = uuid.v4()
}

beforeAll(async () => {
  try {
    jest.setTimeout(1000 * 120)
    if (process.env.ENABLE_VCX_LOGS === 'true') {
      setupVcxLogging()
    }
    const suiteId = `${uuid.v4()}`.replace(/-/gi, '').substring(0, 6)
    tmpDbData = await createDbSchemaApplication(suiteId)
    tmpDbWallet = await createDbSchemaWallets(suiteId)

    const appConfig = getBaseAppConfig(agencyWalletName, agencyDid, agencySeed, agencyWalletKey, undefined, tmpDbWallet.info.database, tmpDbData.info.database)
    app = await buildApplication(appConfig)
    serviceIndyWallets = app.serviceIndyWallets
    entityForwardAgent = app.entityForwardAgent
    serviceStorage = app.serviceStorage
    resolver = app.resolver
    router = app.router

    const agencyClient = await buildAgencyClientVirtual(entityForwardAgent)
    sendToAgency = agencyClient.sendToAgency
    const agencyInfo = await agencyClient.getAgencyInfo()
    agencyVerkey = agencyInfo.verkey
  } catch (err) {
    console.error(err.stack)
    throw err
  }
})

afterAll(async () => {
  await cleanUpApplication(app)
  await tmpDbData.dropDb()
  await tmpDbWallet.dropDb()
})

beforeEach(async () => {
  regenerateUuids()
  {
    agencyUserWalletKey = await indyGenerateWalletKey()
    agencyUserWalletName = `unit-test-${uuid.v4()}`
    await indyCreateWallet(agencyUserWalletName, agencyUserWalletKey, WALLET_KDF)
    agencyUserWh = await indyOpenWallet(agencyUserWalletName, agencyUserWalletKey, WALLET_KDF)
    const { did, vkey } = await indyCreateAndStoreMyDid(agencyUserWh)
    agencyUserDid = did
    agencyUserVerkey = vkey
  }

  const {
    agentDid: aDid1,
    agentVerkey: aVerkey1
  } = await vcxFlowFullOnboarding(agencyUserWh, sendToAgency, agencyDid, agencyVerkey, agencyUserDid, agencyUserVerkey)
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

let agent1Did
let agent1Verkey

describe('message download from agent connection', () => {
  it('should filter messages by status', async () => {
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

  it('should update message status by UID', async () => {
    {
      const msgReply = await vcxFlowGetMsgsFromAgentConn(agencyUserWh, sendToAgency, aconnDid, aconnVerkey, aconnUserPwVkey, [], [msg1Id, msg2Id])
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
    }
    const uidsByConn = [
      { pairwiseDID: 'not-taken-in-consideration', uids: [msg1Id, 'non-existing-uid1'] },
      { pairwiseDID: 'not-taken-in-consideration', uids: [msg2Id, 'non-existing-uid2'] },
      { pairwiseDID: 'not-taken-in-consideration', uids: ['non-existing-uid2'] }
    ]
    const updateRes = await vcxFlowUpdateMsgsFromAgent(agencyUserWh, sendToAgency, agent1Did, agent1Verkey, agencyUserVerkey, uidsByConn, 'MS-106')
    expect(updateRes['@type']).toBe('did:sov:123456789abcdefghi1234;spec/pairwise/1.0/MSG_STATUS_UPDATED_BY_CONNS')
    {
      const msgReply = await vcxFlowGetMsgsFromAgentConn(agencyUserWh, sendToAgency, aconnDid, aconnVerkey, aconnUserPwVkey, [], [msg1Id, msg2Id])
      const { msgs } = msgReply
      const msg1 = msgs.find(msg => msg.uid === msg1Id)
      expect(msg1).toBeDefined()
      expect(msg1.statusCode).toBe('MS-106')
      expect(msg1.payload.msg).toBe('hello')

      const msg2 = msgs.find(msg => msg.uid === msg2Id)
      expect(msg2).toBeDefined()
      expect(msg2.statusCode).toBe('MS-106')
      expect(msg2.payload.msg).toBe('annyeong')
    }
  })

  it('should not update any message if no UIDs are not matching', async () => {
    const uidsByConn = [
      { pairwiseDID: 'not-taken-in-consideration', uids: [] },
      { pairwiseDID: 'not-taken-in-consideration', uids: ['not-matching-uid'] }
    ]
    const updateRes = await vcxFlowUpdateMsgsFromAgent(agencyUserWh, sendToAgency, agent1Did, agent1Verkey, agencyUserVerkey, uidsByConn, 'MS-106')
    expect(updateRes['@type']).toBe('did:sov:123456789abcdefghi1234;spec/pairwise/1.0/MSG_STATUS_UPDATED_BY_CONNS')
    {
      const msgReply = await vcxFlowGetMsgsFromAgentConn(agencyUserWh, sendToAgency, aconnDid, aconnVerkey, aconnUserPwVkey, [], [])
      const { msgs } = msgReply
      const msg1 = msgs.find(msg => msg.uid === msg1Id)
      expect(msg1.statusCode).toBe('MS-103')
      const msg2 = msgs.find(msg => msg.uid === msg2Id)
      expect(msg2.statusCode).toBe('MS-103')
      const msg3 = msgs.find(msg => msg.uid === msg3Id)
      expect(msg3.statusCode).toBe('MS-104')
    }
  })
})
