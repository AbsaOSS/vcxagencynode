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

const { indyCreateWallet } = require('easy-indysdk')
const { indyCreateAndStoreMyDid } = require('easy-indysdk')
const uuid = require('uuid')
const rimraf = require('rimraf')
const os = require('os')
const { vcxFlowUpdateMsgsFromAgent } = require('../../../src')
const { vcxFlowGetMsgsFromAgentConn } = require('../../../src')
const { vcxFlowSendAriesMessage } = require('../../../src')
const { vcxFlowGetMsgsFromAgent } = require('../../../src')
const { buildAgencyClientNetwork } = require('../../common')
const { vcxFlowCreateAgentConnection } = require('vcxagency-client/src')
const { vcxFlowFullOnboarding } = require('vcxagency-client/src')
const { indyGenerateWalletKey } = require('easy-indysdk')
const { indyOpenWallet } = require('easy-indysdk')

let aliceWalletName
let aliceWalletKey
let aliceDid
let aliceVerkey
let aliceWh

let bobWalletName
let bobWalletKey
let bobDid
let bobVerkey
let bobWh

const WALLET_KDF = 'RAW'

let agencyVerkey
let agencyDid
let sendToAgency

let agencyClient

const agencyUrl = process.env.AGENCY_URL || 'http://localhost:8080'

beforeAll(async () => {
  jest.setTimeout(1000 * 120)
  // logger.error = (data) => console.error(data)
  // logger.warn = (data) => console.warn(data)
  // logger.info = (data) => console.log(data)
  // logger.debug = (data) => console.log(data)
  // logger.silly = (data) => console.log(data)
  // indySetLogger(logger)
  console.log(`Using agency url ${agencyUrl}`)
  agencyClient = await buildAgencyClientNetwork(agencyUrl)
  sendToAgency = agencyClient.sendToAgency
  const agencyInfo = await agencyClient.getAgencyInfo()
  agencyVerkey = agencyInfo.verkey
  agencyDid = agencyInfo.did
})

beforeEach(async () => {
  {
    aliceWalletKey = await indyGenerateWalletKey()
    aliceWalletName = `unit-test-${uuid.v4()}`
    await indyCreateWallet(aliceWalletName, aliceWalletKey, WALLET_KDF)
    aliceWh = await indyOpenWallet(aliceWalletName, aliceWalletKey, WALLET_KDF)
    const { did, vkey } = await indyCreateAndStoreMyDid(aliceWh)
    aliceDid = did
    aliceVerkey = vkey
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
})

afterEach(async () => {
  const homedir = os.homedir()
  const clientWalletPath = `${homedir}/.indy_client/wallet/${aliceWalletName}`
  const attackerWalletPath = `${homedir}/.indy_client/wallet/${bobWalletName}`
  await rimraf.sync(clientWalletPath)
  await rimraf.sync(attackerWalletPath)
})

describe('onboarding', () => {
  it('should exchange messages between alice and bob via agency', async () => {
    // arrange
    const { agentDid: aliceAgentDid, agentVerkey: aliceAgentVerkey } = await vcxFlowFullOnboarding(aliceWh, sendToAgency, agencyDid, agencyVerkey, aliceDid, aliceVerkey)
    const { did: aliceUserPairwiseDid, vkey: aliceUserPairwiseVerkey } = await indyCreateAndStoreMyDid(aliceWh)
    console.log('Alice was onboarded.')

    const { agentDid: bobAgentDid, agentVerkey: bobAgentVerkey } = await vcxFlowFullOnboarding(bobWh, sendToAgency, agencyDid, agencyVerkey, bobDid, bobVerkey)
    const { did: bobUserPairwiseDid, vkey: bobUserPairwiseVerkey } = await indyCreateAndStoreMyDid(bobWh)
    console.log('Bob was onboarded.')

    // create agent connection, both alice and bob
    console.log(`Alice is going to create agent connection. aliceAgentDid=${aliceAgentDid} aliceVerkey=${aliceVerkey} aliceUserPairwiseDid=${aliceUserPairwiseDid} aliceUserPairwiseVerkey=${aliceUserPairwiseVerkey}`)
    const alicesAconn = await vcxFlowCreateAgentConnection(aliceWh, sendToAgency, aliceAgentDid, aliceAgentVerkey, aliceVerkey, aliceUserPairwiseDid, aliceUserPairwiseVerkey)
    const alicesRoutingAgentDid = alicesAconn.withPairwiseDID
    const alicesRoutingAgentVerkey = alicesAconn.withPairwiseDIDVerKey
    console.log('Alice created agent connection!')
    await vcxFlowCreateAgentConnection(bobWh, sendToAgency, bobAgentDid, bobAgentVerkey, bobVerkey, bobUserPairwiseDid, bobUserPairwiseVerkey)

    const aliceAllMsgs1 = await vcxFlowGetMsgsFromAgent(aliceWh, sendToAgency, aliceAgentDid, aliceAgentVerkey, aliceVerkey, [], [], [])
    console.log(`Alice queries agency for all messages, she should have none. Response = ${JSON.stringify(aliceAllMsgs1)}`)

    // bobs sends message to alices routing agent
    const bobSendMsgRes1 = await vcxFlowSendAriesMessage(bobWh, sendToAgency, aliceUserPairwiseVerkey, alicesRoutingAgentVerkey, bobUserPairwiseVerkey, 'This is Bob!')
    console.log(`Bob sends aries message to Alice's agent. Response = ${JSON.stringify(bobSendMsgRes1)}`)

    // alice fetches messages
    const aliceAllMsgs2 = await vcxFlowGetMsgsFromAgent(aliceWh, sendToAgency, aliceAgentDid, aliceAgentVerkey, aliceVerkey, [], [], [])
    console.log(`Alice queries agency for all messages, she should have one. Response = ${JSON.stringify(aliceAllMsgs2)}`)

    const aliceToBoMsgs = await vcxFlowGetMsgsFromAgentConn(aliceWh, sendToAgency, alicesRoutingAgentDid, alicesRoutingAgentVerkey, aliceUserPairwiseVerkey, [], [])
    console.log(`Alice queries agency for alice2bob messages, she should have one. Response = ${JSON.stringify(aliceToBoMsgs)}`)

    // alice updates message status
    const aliceMsgsByConns = [
      { pairwiseDID: aliceUserPairwiseDid, uids: [aliceToBoMsgs.msgs[0].uid] }
    ]
    const aliceNewMsgStatus = 'MS-104'
    const updateResponse = await vcxFlowUpdateMsgsFromAgent(aliceWh, sendToAgency, aliceAgentDid, aliceAgentVerkey, aliceVerkey, aliceMsgsByConns, aliceNewMsgStatus)
    console.log(`Alice run msg status update for msgs ${JSON.stringify(aliceMsgsByConns)} to status ${aliceNewMsgStatus}. Response = ${JSON.stringify(updateResponse)}`)

    // alice tries to update msg status on connection she doesn't have
    const updateMsgForNonExistingUserPwDid = [
      { pairwiseDID: '4aA6TyH2Cgq7gg2wGFiRXS', uids: [aliceToBoMsgs.msgs[0].uid] }
    ]
    const aliceNewMsgStatus2 = 'MS-105'
    const updateResponse2 = await vcxFlowUpdateMsgsFromAgent(aliceWh, sendToAgency, aliceAgentDid, aliceAgentVerkey, aliceVerkey, updateMsgForNonExistingUserPwDid, aliceNewMsgStatus2)
    console.log(`Alice run msg status update for agent connection which does not exists on her agent. Response = ${JSON.stringify(updateResponse2)}`)
  })
})

describe('healthchecks', () => {
  it('agency should be healthy', async () => {
    const { success } = await agencyClient.isHealthy()
    expect(success).toBe('true')
  })
})
