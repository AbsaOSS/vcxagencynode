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
const { indyCreateWallet, indyCreateAndStoreMyDid, indyOpenWallet, indyGenerateWalletKey } = require('easy-indysdk')
const {
  vcxFlowUpdateMsgsFromAgent,
  vcxFlowGetMsgsFromAgent,
  vcxFlowCreateAgentConnection,
  vcxFlowFullOnboarding
} = require('vcxagency-client')
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

let app // eslint-disable-line
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

let bobWalletName
let bobWalletKey
let bobDid
let bobVerkey
let bobWh

const WALLET_KDF = 'RAW'
let sendToAgency

let tmpPgDb
beforeAll(async () => {
  jest.setTimeout(1000 * 120)
  if (process.env.ENABLE_VCX_LOGS) {
    setupVcxLogging()
  }
  tmpPgDb = await createTestPgDb()
  app = await wireUpApplication(tmpPgDb.info, REDIS_URL, agencyWalletName, agencyDid, agencySeed, agencyWalletKey)
  serviceIndyWallets = app.serviceIndyWallets
  entityForwardAgent = app.entityForwardAgent
  serviceStorage = app.serviceStorage
  resolver = app.resolver
  router = app.router

  const agencyClient = await buildAgencyClientVirtual(entityForwardAgent)
  sendToAgency = agencyClient.sendToAgency
  const agencyInfo = await agencyClient.getAgencyInfo()
  agencyVerkey = agencyInfo.verkey
})

afterAll(async () => {
  cleanUpApplication(app)
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
  {
    bobWalletKey = await indyGenerateWalletKey()
    bobWalletName = `unit-test-${uuid.v4()}`
    await indyCreateWallet(bobWalletName, bobWalletKey, WALLET_KDF)
    bobWh = await indyOpenWallet(bobWalletName, bobWalletKey, WALLET_KDF)
    const { did, vkey } = await indyCreateAndStoreMyDid(bobWh)
    bobDid = did
    bobVerkey = vkey
  }

  // create 2 agents
  const { agentDid: aDid1, agentVerkey: aVerkey1 } = await vcxFlowFullOnboarding(agencyUserWh, sendToAgency, agencyDid, agencyVerkey, agencyUserDid, agencyUserVerkey)
  agent1Did = aDid1
  agent1Verkey = aVerkey1
  await vcxFlowFullOnboarding(bobWh, sendToAgency, agencyDid, agencyVerkey, bobDid, bobVerkey)

  // create 2 agency connections for agent1
  const { did: userPairwiseDid1, vkey: userPairwiseVerkey1 } = await indyCreateAndStoreMyDid(agencyUserWh)
  aconn1UserPwDid = userPairwiseDid1
  const msgKeyCreated1 = await vcxFlowCreateAgentConnection(agencyUserWh, sendToAgency, agent1Did, agent1Verkey, agencyUserVerkey, aconn1UserPwDid, userPairwiseVerkey1)
  const aconn1Did = msgKeyCreated1.withPairwiseDID

  const { did: userPairwiseDid2, vkey: userPairwiseVerkey2 } = await indyCreateAndStoreMyDid(agencyUserWh)
  aconn2UserPwDid = userPairwiseDid2
  const msgKeyCreated2 = await vcxFlowCreateAgentConnection(agencyUserWh, sendToAgency, agent1Did, agent1Verkey, agencyUserVerkey, aconn2UserPwDid, userPairwiseVerkey2)
  const aconn2Did = msgKeyCreated2.withPairwiseDID

  // connection without messages
  const { did: userPairwiseDid3, vkey: userPairwiseVerkey3 } = await indyCreateAndStoreMyDid(agencyUserWh)
  aconn3UserPwDid = userPairwiseDid3
  await vcxFlowCreateAgentConnection(agencyUserWh, sendToAgency, agent1Did, agent1Verkey, agencyUserVerkey, aconn3UserPwDid, userPairwiseVerkey3)

  // store messages for agent1 connections
  await serviceStorage.storeMessage(agent1Did, aconn1Did, msg1Id, 'MS-103', { msg: 'a1conn1-msg1' })
  await serviceStorage.storeMessage(agent1Did, aconn1Did, msg2Id, 'MS-103', { msg: 'a1conn1-msg2' })
  await serviceStorage.storeMessage(agent1Did, aconn1Did, msg3Id, 'MS-104', { msg: 'a1conn1-msg3' })
  await serviceStorage.storeMessage(agent1Did, aconn2Did, msg4Id, 'MS-103', { msg: 'a1conn2-msg4' })
  await serviceStorage.storeMessage(agent1Did, aconn2Did, msg5Id, 'MS-103', { msg: 'a1conn2-msg5' })
  await serviceStorage.storeMessage(agent1Did, aconn2Did, msg6Id, 'MS-104', { msg: 'a1conn2-msg6' })

  // // store messages for bob
  // const bobConn1Did = uuid.v4()
  // const bobConn2Did = uuid.v4()
  // await serviceStorage.storeMessage(agent2Did, bobConn1Did, msg1Id, 'MS-103', { msg: 'a2conn1-msg1' })
  // await serviceStorage.storeMessage(agent2Did, bobConn1Did, msg2Id, 'MS-103', { msg: 'a2conn1-msg2' })
  // await serviceStorage.storeMessage(agent2Did, bobConn1Did, msg3Id, 'MS-104', { msg: 'a2conn1-msg3' })
  // await serviceStorage.storeMessage(agent2Did, bobConn2Did, msg4Id, 'MS-103', { msg: 'a2conn2-msg1' })
  // await serviceStorage.storeMessage(agent2Did, bobConn2Did, msg5Id, 'MS-103', { msg: 'a2conn2-msg2' })
  // await serviceStorage.storeMessage(agent2Did, bobConn2Did, msg6Id, 'MS-104', { msg: 'a2conn2-msg3' })
})

afterEach(async () => {
  const homedir = os.homedir()
  const clientWalletPath = `${homedir}/.indy_client/wallet/${agencyUserWalletName}`
  const attackerWalletPath = `${homedir}/.indy_client/wallet/${bobWalletName}`
  await rimraf.sync(clientWalletPath)
  await rimraf.sync(attackerWalletPath)
})

let aconn1UserPwDid
let aconn2UserPwDid
let aconn3UserPwDid

const msg1Id = uuid.v4()
const msg2Id = uuid.v4()
const msg3Id = uuid.v4()
const msg4Id = uuid.v4()
const msg5Id = uuid.v4()
const msg6Id = uuid.v4()

let agent1Did
let agent1Verkey

describe('onboarding', () => {
  it('should download all messages of all agent-connections', async () => {
    // act
    const msgReply = await vcxFlowGetMsgsFromAgent(agencyUserWh, sendToAgency, agent1Did, agent1Verkey, agencyUserVerkey, [], [], [])
    expect(msgReply['@type']).toBe('did:sov:123456789abcdefghi1234;spec/pairwise/1.0/MSGS_BY_CONNS')
    const { msgsByConns } = msgReply
    expect(Array.isArray(msgsByConns)).toBeTruthy()
    expect(msgsByConns.length).toBe(3)
    {
      const msgsByConn1 = msgsByConns.find(msgsByConn => msgsByConn.pairwiseDID === aconn1UserPwDid)
      expect(msgsByConn1).toBeDefined()
      expect(msgsByConn1.msgs.length).toBe(3)
      const msg1 = msgsByConn1.msgs.find(msg => msg.uid === msg1Id)
      expect(msg1).toBeDefined()
      expect(msg1.payload.msg).toBe('a1conn1-msg1')
      const msg2 = msgsByConn1.msgs.find(msg => msg.uid === msg2Id)
      expect(msg2).toBeDefined()
      expect(msg2.payload.msg).toBe('a1conn1-msg2')
      const msg3 = msgsByConn1.msgs.find(msg => msg.uid === msg3Id)
      expect(msg3).toBeDefined()
      expect(msg3.payload.msg).toBe('a1conn1-msg3')
    }
    {
      const msgsByConn2 = msgsByConns.find(msgsByConn => msgsByConn.pairwiseDID === aconn2UserPwDid)
      expect(msgsByConn2).toBeDefined()
      expect(msgsByConn2.msgs.length).toBe(3)
      const msg4 = msgsByConn2.msgs.find(msg => msg.uid === msg4Id)
      expect(msg4).toBeDefined()
      expect(msg4.payload.msg).toBe('a1conn2-msg4')
      const msg5 = msgsByConn2.msgs.find(msg => msg.uid === msg5Id)
      expect(msg5).toBeDefined()
      expect(msg5.payload.msg).toBe('a1conn2-msg5')
      const msg6 = msgsByConn2.msgs.find(msg => msg.uid === msg6Id)
      expect(msg6).toBeDefined()
      expect(msg6.payload.msg).toBe('a1conn2-msg6')
    }
    {
      const msgsByConn3 = msgsByConns.find(msgsByConn => msgsByConn.pairwiseDID === aconn3UserPwDid)
      expect(msgsByConn3).toBeDefined()
      expect(msgsByConn3.msgs.length).toBe(0)
    }
  })

  it('should filter messages by userPwDids', async () => {
    // act
    const msgReply = await vcxFlowGetMsgsFromAgent(agencyUserWh, sendToAgency, agent1Did, agent1Verkey, agencyUserVerkey, [aconn1UserPwDid], [], [])
    const { msgsByConns } = msgReply
    expect(Array.isArray(msgsByConns)).toBeTruthy()
    expect(msgsByConns.length).toBe(1)
    const msgsByConn1 = msgsByConns.find(msgsByConn => msgsByConn.pairwiseDID === aconn1UserPwDid)
    expect(msgsByConn1).toBeDefined()
    expect(msgsByConn1.msgs.length).toBe(3)
    expect(msgsByConn1.msgs.find(msg => msg.uid === msg1Id)).toBeDefined()
    expect(msgsByConn1.msgs.find(msg => msg.uid === msg2Id)).toBeDefined()
    expect(msgsByConn1.msgs.find(msg => msg.uid === msg3Id)).toBeDefined()
  })

  it('should filter messages by uids', async () => {
    // act
    const msgReply = await vcxFlowGetMsgsFromAgent(agencyUserWh, sendToAgency, agent1Did, agent1Verkey, agencyUserVerkey, [], [msg1Id, msg6Id], [])
    const { msgsByConns } = msgReply
    expect(Array.isArray(msgsByConns)).toBeTruthy()
    expect(msgsByConns.length).toBe(3)

    const msgsByConn1 = msgsByConns.find(msgsByConn => msgsByConn.pairwiseDID === aconn1UserPwDid)
    expect(msgsByConn1).toBeDefined()
    expect(msgsByConn1.msgs.length).toBe(1)
    expect(msgsByConn1.msgs.find(msg => msg.uid === msg1Id)).toBeDefined()

    const msgsByConn2 = msgsByConns.find(msgsByConn => msgsByConn.pairwiseDID === aconn2UserPwDid)
    expect(msgsByConn2).toBeDefined()
    expect(msgsByConn2.msgs.length).toBe(1)
    expect(msgsByConn2.msgs.find(msg => msg.uid === msg6Id)).toBeDefined()
  })

  it('should filter messages by status', async () => {
    // act
    const msgReply = await vcxFlowGetMsgsFromAgent(agencyUserWh, sendToAgency, agent1Did, agent1Verkey, agencyUserVerkey, [], [], ['MS-104'])
    const { msgsByConns } = msgReply
    expect(Array.isArray(msgsByConns)).toBeTruthy()
    expect(msgsByConns.length).toBe(3)

    const msgsByConn1 = msgsByConns.find(msgsByConn => msgsByConn.pairwiseDID === aconn1UserPwDid)
    expect(msgsByConn1).toBeDefined()
    expect(msgsByConn1.msgs.length).toBe(1)
    expect(msgsByConn1.msgs.find(msg => msg.uid === msg3Id)).toBeDefined()

    const msgsByConn2 = msgsByConns.find(msgsByConn => msgsByConn.pairwiseDID === aconn2UserPwDid)
    expect(msgsByConn2).toBeDefined()
    expect(msgsByConn2.msgs.length).toBe(1)
    expect(msgsByConn2.msgs.find(msg => msg.uid === msg6Id)).toBeDefined()
  })

  it('should filter messages by userPwDids and status', async () => {
    // act
    const msgReply = await vcxFlowGetMsgsFromAgent(agencyUserWh, sendToAgency, agent1Did, agent1Verkey, agencyUserVerkey, [aconn1UserPwDid], [], ['MS-104'])
    const { msgsByConns } = msgReply
    expect(Array.isArray(msgsByConns)).toBeTruthy()
    expect(msgsByConns.length).toBe(1)

    const msgsByConn1 = msgsByConns.find(msgsByConn => msgsByConn.pairwiseDID === aconn1UserPwDid)
    expect(msgsByConn1).toBeDefined()
    expect(msgsByConn1.msgs.length).toBe(1)
    expect(msgsByConn1.msgs.find(msg => msg.uid === msg3Id)).toBeDefined()
  })

  it('should filter messages by userPwDids and uids', async () => {
    // act
    const msgReply = await vcxFlowGetMsgsFromAgent(agencyUserWh, sendToAgency, agent1Did, agent1Verkey, agencyUserVerkey, [aconn1UserPwDid], [msg1Id, msg2Id, msg3Id, msg4Id, msg5Id, msg6Id], [])
    const { msgsByConns } = msgReply
    expect(Array.isArray(msgsByConns)).toBeTruthy()
    expect(msgsByConns.length).toBe(1)

    const msgsByConn1 = msgsByConns.find(msgsByConn => msgsByConn.pairwiseDID === aconn1UserPwDid)
    expect(msgsByConn1).toBeDefined()
    expect(msgsByConn1.msgs.length).toBe(3)
    expect(msgsByConn1.msgs.find(msg => msg.uid === msg1Id)).toBeDefined()
    expect(msgsByConn1.msgs.find(msg => msg.uid === msg2Id)).toBeDefined()
    expect(msgsByConn1.msgs.find(msg => msg.uid === msg3Id)).toBeDefined()
  })

  it('should filter messages only by uids', async () => {
    // act
    const msgReply = await vcxFlowGetMsgsFromAgent(agencyUserWh, sendToAgency, agent1Did, agent1Verkey, agencyUserVerkey, null, [msg1Id, msg2Id, msg3Id, msg4Id], [])
    const { msgsByConns } = msgReply
    expect(Array.isArray(msgsByConns)).toBeTruthy()
    expect(msgsByConns.length).toBe(3)

    console.log(JSON.stringify(msgsByConns))

    const msgsByConn1 = msgsByConns.find(msgsByConn => msgsByConn.pairwiseDID === aconn1UserPwDid)
    expect(msgsByConn1).toBeDefined()
    expect(msgsByConn1.msgs.length).toBe(3)
    expect(msgsByConn1.msgs.find(msg => msg.uid === msg1Id)).toBeDefined()
    expect(msgsByConn1.msgs.find(msg => msg.uid === msg2Id)).toBeDefined()
    expect(msgsByConn1.msgs.find(msg => msg.uid === msg3Id)).toBeDefined()

    const msgsByConn2 = msgsByConns.find(msgsByConn => msgsByConn.pairwiseDID === aconn2UserPwDid)
    expect(msgsByConn2).toBeDefined()
    expect(msgsByConn2.msgs.length).toBe(1)
    expect(msgsByConn2.msgs.find(msg => msg.uid === msg4Id)).toBeDefined()

    const msgsByConn3 = msgsByConns.find(msgsByConn => msgsByConn.pairwiseDID === aconn3UserPwDid)
    expect(msgsByConn3).toBeDefined()
    expect(msgsByConn3.msgs.length).toBe(0)
  })

  it('should filter messages by status and uids', async () => {
    // act
    const msgReply = await vcxFlowGetMsgsFromAgent(agencyUserWh, sendToAgency, agent1Did, agent1Verkey, agencyUserVerkey, [], [msg1Id, msg2Id, msg3Id, msg4Id, msg5Id, msg6Id], ['MS-106'])
    const { msgsByConns } = msgReply
    expect(Array.isArray(msgsByConns)).toBeTruthy()
    expect(msgsByConns.length).toBe(3)
    const msgsByConn1 = msgsByConns.find(msgsByConn => msgsByConn.pairwiseDID === aconn1UserPwDid)
    expect(msgsByConn1.msgs.length).toBe(0)
    const msgsByConn2 = msgsByConns.find(msgsByConn => msgsByConn.pairwiseDID === aconn2UserPwDid)
    expect(msgsByConn2.msgs.length).toBe(0)
    const msgsByConn3 = msgsByConns.find(msgsByConn => msgsByConn.pairwiseDID === aconn3UserPwDid)
    expect(msgsByConn3.msgs.length).toBe(0)
  })

  it('should update statusCodes of messages', async () => {
    // act
    const uidsByConn = [
      { pairwiseDID: aconn1UserPwDid, uids: [msg1Id, msg2Id, 'wronguid123'] },
      { pairwiseDID: aconn2UserPwDid, uids: [msg6Id, 'wronguid456'] }
    ]
    const updateRes = await vcxFlowUpdateMsgsFromAgent(agencyUserWh, sendToAgency, agent1Did, agent1Verkey, agencyUserVerkey, uidsByConn, 'MS-106')
    expect(updateRes['@type']).toBe('did:sov:123456789abcdefghi1234;spec/pairwise/1.0/MSG_STATUS_UPDATED_BY_CONNS')
    expect(updateRes.failed.length).toBe(2)
    const failed1 = updateRes.failed.find(update => update.pairwiseDID === aconn1UserPwDid)
    const failed2 = updateRes.failed.find(update => update.pairwiseDID === aconn2UserPwDid)
    expect(failed1.uids[0]).toBe('wronguid123')
    expect(failed2.uids[0]).toBe('wronguid456')

    expect(updateRes.updatedUidsByConns.length).toBe(2)
    const updated1 = updateRes.updatedUidsByConns.find(update => update.pairwiseDID === aconn1UserPwDid)
    const updated2 = updateRes.updatedUidsByConns.find(update => update.pairwiseDID === aconn2UserPwDid)

    expect(updated1).toBeDefined()
    expect(updated1.uids.length).toBe(2)
    expect(updated1.uids.includes(msg1Id)).toBeTruthy()
    expect(updated1.uids.includes(msg2Id)).toBeTruthy()
    expect(updated1.uids.includes('wronguid123')).toBeFalsy()

    expect(updated2).toBeDefined()
    expect(updated2.uids.length).toBe(1)
    expect(updated2.uids.includes(msg6Id)).toBeTruthy()
    expect(updated2.uids.includes('wronguid123')).toBeFalsy()

    const msgReply = await vcxFlowGetMsgsFromAgent(agencyUserWh, sendToAgency, agent1Did, agent1Verkey, agencyUserVerkey, [aconn1UserPwDid, aconn2UserPwDid], [], [])
    const { msgsByConns } = msgReply
    expect(Array.isArray(msgsByConns)).toBeTruthy()
    expect(msgsByConns.length).toBe(2)

    const msgsByConn1 = msgsByConns.find(msgsByConn => msgsByConn.pairwiseDID === aconn1UserPwDid)
    expect(msgsByConn1).toBeDefined()
    expect(msgsByConn1.msgs.length).toBe(3)
    assertMsgsByConHasMessageWithStatus(msgsByConn1, msg1Id, 'MS-106')
    assertMsgsByConHasMessageWithStatus(msgsByConn1, msg2Id, 'MS-106')
    assertMsgsByConHasMessageWithStatus(msgsByConn1, msg3Id, 'MS-104')

    const msgsByConn2 = msgsByConns.find(msgsByConn => msgsByConn.pairwiseDID === aconn2UserPwDid)
    expect(msgsByConn2).toBeDefined()
    expect(msgsByConn2.msgs.length).toBe(3)
    assertMsgsByConHasMessageWithStatus(msgsByConn2, msg4Id, 'MS-103')
    assertMsgsByConHasMessageWithStatus(msgsByConn2, msg5Id, 'MS-103')
    assertMsgsByConHasMessageWithStatus(msgsByConn2, msg6Id, 'MS-106')
  })

  it('should not update any message statusCode of no uids are specified in update request', async () => {
    // act
    const uidsByConn = [
      { pairwiseDID: aconn1UserPwDid, uids: [] },
      { pairwiseDID: aconn2UserPwDid, uids: [] }
    ]
    const updateRes = await vcxFlowUpdateMsgsFromAgent(agencyUserWh, sendToAgency, agent1Did, agent1Verkey, agencyUserVerkey, uidsByConn, 'MS-106')
    expect(updateRes['@type']).toBe('did:sov:123456789abcdefghi1234;spec/pairwise/1.0/MSG_STATUS_UPDATED_BY_CONNS')
    expect(updateRes.failed.length).toBe(0)
    expect(updateRes.updatedUidsByConns.length).toBe(0)
  })

  function assertMsgsByConHasMessageWithStatus (msgsByConn, msgId, expectedStatusCode) {
    const msg = msgsByConn.msgs.find(msg => msg.uid === msgId)
    expect(msg).toBeDefined()
    expect(msg.statusCode).toBe(expectedStatusCode)
  }
})
