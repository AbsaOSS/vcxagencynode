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
const { vcxFlowSendAriesMessage, vcxFlowGetMsgsFromAgentConn } = require('../../../src')
const { buildAgencyClientNetwork } = require('../../common')
const { vcxFlowCreateAgentConnection } = require('vcxagency-client/src')
const { vcxFlowFullOnboarding } = require('vcxagency-client/src')
const { indyGenerateWalletKey } = require('easy-indysdk')
const { indyOpenWallet } = require('easy-indysdk')
const axios = require('axios')
const sleep = require('sleep-promise')

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

const agencyUrl = process.env.AGENCY_URL || 'http://localhost:8080'

beforeAll(async () => {
  jest.setTimeout(1000 * 120)
  const agencyClient = await buildAgencyClientNetwork(agencyUrl)
  console.log(`Using agency url ${agencyUrl}`)
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

describe('longpoll', () => {
  it('should return longpoll on new message or timeout', async () => {
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

    const aliceAllMsgs1 = await vcxFlowGetMsgsFromAgentConn(aliceWh, sendToAgency, alicesRoutingAgentDid, alicesRoutingAgentVerkey, aliceUserPairwiseVerkey, [], [])
    console.log(`Alice queries agency for all messages, she should have none. Response = ${JSON.stringify(aliceAllMsgs1)}`)
    {
      let hasLongpollTimedOut = false
      axios.get(`${agencyUrl}/experimental/agent/${aliceAgentDid}/notifications`, { timeout: 2000 })
        .then(_result => {
          console.error('Did not expect longpoll to return so early with success!')
          expect(true).toBeFalsy()
        })
        .catch(_err => {
          console.info('Axios returned error as expected.')
          hasLongpollTimedOut = true
        })

      await sleep(3000)
      expect(hasLongpollTimedOut).toBeTruthy()
    }
    // bobs sends message to alices routing agent
    const bobSendMsgRes1 = await vcxFlowSendAriesMessage(bobWh, sendToAgency, aliceUserPairwiseVerkey, alicesRoutingAgentVerkey, bobUserPairwiseVerkey, 'This is Bob!')
    console.log(`Bob sends aries message to Alice's agent. Response = ${JSON.stringify(bobSendMsgRes1)}`)
    await sleep(2000)

    // alice asks for new messages and get right away response with hasNotifications=true
    {
      const { data: { hasNotifications } } = await axios.get(`${agencyUrl}/experimental/agent/${aliceAgentDid}/notifications`, { timeout: 500 })
      expect(hasNotifications).toBeTruthy()
      await axios.post(`${agencyUrl}/experimental/agent/${aliceAgentDid}/notifications/ack`)
    }

    // since new messages were acked, next time the longpoll should keep hanging, and given short client timeout of 2000ms, we should get timeout error
    axios.get(`${agencyUrl}/experimental/agent/${aliceAgentDid}/notifications`, { timeout: 2000 })
      .then(_result => {
        console.error('Did not expect longpoll to return so early with success!')
        expect(true).toBeFalsy()
      })
      .catch(_err => {
        console.info('Axios returned error as expected.')
      })

    await sleep(3000)
  })
})
