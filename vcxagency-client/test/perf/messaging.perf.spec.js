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
const { vcxFlowUpdateMsgsFromAgent } = require('../../src')
const { vcxFlowGetMsgsFromAgent } = require('../../src')
const { vcxFlowSendAriesMessage } = require('../../src')
const { buildAgencyClientNetwork } = require('../common')
const { vcxFlowCreateAgentConnection } = require('vcxagency-client')
const { vcxFlowFullOnboarding } = require('vcxagency-client')
const { indyGenerateWalletKey } = require('easy-indysdk')
const { indyOpenWallet } = require('easy-indysdk')
const { performance } = require('perf_hooks')

const WALLET_KDF = 'RAW'

let agencyVerkey
let agencyDid
let sendToAgency

const agencyUrl = process.env.AGENCY_URL || 'http://localhost:8080'
const vcxClients = []

beforeAll(async () => {
  jest.setTimeout(1000 * 1000)
  // logger.error = (data) => console.error(data)
  // logger.warn = (data) => console.warn(data)
  // logger.info = (data) => console.log(data)
  // logger.debug = (data) => console.log(data)
  // logger.silly = (data) => console.log(data)
  // indySetLogger(logger)
  const agencyClient = await buildAgencyClientNetwork(agencyUrl)
  sendToAgency = agencyClient.sendToAgency
  const agencyInfo = await agencyClient.getAgencyInfo()
  agencyVerkey = agencyInfo.verkey
  agencyDid = agencyInfo.did
})

afterAll(async () => {
  const homedir = os.homedir()
  for (const client of vcxClients) {
    const { walletName } = client
    const clientWalletPath = `${homedir}/.indy_client/wallet/${walletName}`
    await rimraf.sync(clientWalletPath)
  }
})

async function setupVcxClient () {
  const walletKey = await indyGenerateWalletKey()
  const walletName = `unit-perftest-${uuid.v4()}`
  await indyCreateWallet(walletName, walletKey, WALLET_KDF)
  const wh = await indyOpenWallet(walletName, walletKey, WALLET_KDF)
  const { did: client2AgencyDid, vkey: client2AgencyVerkey } = await indyCreateAndStoreMyDid(wh)
  const userPwDids = []
  for (let i = 0; i < 2; i++) {
    const { did, vkey } = await indyCreateAndStoreMyDid(wh)
    userPwDids.push({ did, vkey })
  }
  return {
    walletKey,
    walletName,
    wh,
    client2AgencyDid,
    client2AgencyVerkey,
    userPwDids
  }
}

const ROUNDS = process.env.ROUNDS || 1000
const OPS_IN_ROUND = process.env.OPS_IN_ROUND || 2

describe('onboarding', () => {
  it('should send many messages', async () => {
    const clientAlice = await setupVcxClient()
    const clientBob = await setupVcxClient()
    const clientJohn = await setupVcxClient()
    vcxClients.push(clientAlice)
    vcxClients.push(clientBob)
    vcxClients.push(clientJohn)

    const aliceUserPwDid2Bob = clientAlice.userPwDids[0].did
    const aliceUserPwVerkey2Bob = clientAlice.userPwDids[0].vkey
    const { agentDid: aliceAgentDid, agentVerkey: aliceAgentVerkey } = await vcxFlowFullOnboarding(clientAlice.wh, sendToAgency, agencyDid, agencyVerkey, clientAlice.client2AgencyDid, clientAlice.client2AgencyVerkey)
    const aliceAconnAlice2Bob = await vcxFlowCreateAgentConnection(
      clientAlice.wh, sendToAgency, aliceAgentDid, aliceAgentVerkey, clientAlice.client2AgencyVerkey, aliceUserPwDid2Bob, aliceUserPwVerkey2Bob)
    const aliceRoutingKeyAlice2Bob = aliceAconnAlice2Bob.withPairwiseDIDVerKey

    const bobsUserPwVkey = clientBob.userPwDids[0].vkey

    console.log(`Starting messaging test. Will do ${ROUNDS} rounds of ${OPS_IN_ROUND} messages`)
    {
      const tStart = performance.now()
      for (let i = 0; i < ROUNDS; i++) {
        if (i % 50 === 0) {
          console.log(`Round ${i}`)
        }
        const promises = []
        for (let j = 0; j < OPS_IN_ROUND; j++) {
          promises.push(vcxFlowSendAriesMessage(clientBob.wh, sendToAgency, aliceUserPwVerkey2Bob, aliceRoutingKeyAlice2Bob, bobsUserPwVkey, uuid.v4()))
        }
        await Promise.all(promises)
        if (i === 0) {
          // update all messages received so farr to MS-106 statusCode
          const msgs = await vcxFlowGetMsgsFromAgent(clientAlice.wh, sendToAgency, aliceAgentDid, aliceAgentVerkey, clientAlice.client2AgencyVerkey, [aliceUserPwDid2Bob], [], [])
          console.log(JSON.stringify(msgs))
          const receivedMsgUids = msgs.msgsByConns[0].msgs.map(msg => msg.uid)
          console.log(JSON.stringify(receivedMsgUids))
          await vcxFlowUpdateMsgsFromAgent(clientAlice.wh, sendToAgency, aliceAgentDid, aliceAgentVerkey, clientAlice.client2AgencyVerkey,
            [{ pairwiseDID: aliceUserPwDid2Bob, uids: receivedMsgUids }], 'MS-106')
          // const msgs2 = await vcxFlowGetMsgsFromAgent(clientAlice.wh, sendToAgency, aliceAgentDid, aliceAgentVerkey, clientAlice.client2AgencyVerkey, [aliceUserPwDid2Bob], [], [])
        }
      }
      const tFinish = performance.now()
      const durationSec = (tFinish - tStart) / 1000
      const totalMessages = ROUNDS * OPS_IN_ROUND
      const msgsPerSec = totalMessages / durationSec
      const msgsPerMinute = msgsPerSec * 60
      console.log(`Duration ${durationSec} to send ${totalMessages} messages. MsgsPerSec ${msgsPerSec}   MsgsPerMinute ${msgsPerMinute} `)
    }

    {
      const tStart = performance.now()
      for (let i = 0; i < ROUNDS; i++) {
        if (i % 50 === 0) {
          console.log(`Round ${i}`)
        }
        const promises = []
        for (let j = 0; j < OPS_IN_ROUND; j++) {
          promises.push(
            vcxFlowGetMsgsFromAgent(clientAlice.wh, sendToAgency, aliceAgentDid, aliceAgentVerkey, clientAlice.client2AgencyVerkey, [aliceUserPwDid2Bob], [], ['MS-106'])
          )
        }
        await Promise.all(promises)
      }
      const tFinish = performance.now()
      const durationSec = (tFinish - tStart) / 1000
      const totalRequests = ROUNDS * OPS_IN_ROUND
      const msgsPerSec = totalRequests / durationSec
      const msgsPerMinute = msgsPerSec * 60
      console.log(`Duration ${durationSec} to fetch messages ${totalRequests} messages. MsgsPerSec ${msgsPerSec}   MsgsPerMinute ${msgsPerMinute} `)
    }
  })
})
