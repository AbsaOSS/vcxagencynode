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
const { buildAgencyClientNetwork } = require('../common')
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

const ROUNDS = process.env.ROUNDS

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
  await setupVcxClients(ROUNDS)
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
  for (let i = 0; i < 1; i++) {
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

async function setupVcxClients (n) {
  for (let i = 0; i < n; i++) {
    const client = await setupVcxClient()
    vcxClients.push(client)
  }
}

describe('onboarding', () => {
  it('should create agent and agent connection', async () => {
    const tStart = performance.now()
    for (const vcxClient of vcxClients) {
      const { wh, client2AgencyDid, client2AgencyVerkey } = vcxClient
      await vcxFlowFullOnboarding(wh, sendToAgency, agencyDid, agencyVerkey, client2AgencyDid, client2AgencyVerkey)
    }
    const tFinish = performance.now()
    const durationSec = (tFinish - tStart) / 1000
    const totalRequests = ROUNDS
    const msgsPerSec = totalRequests / durationSec
    const msgsPerMinute = msgsPerSec * 60
    console.log(`Duration ${durationSec} to onboard ${totalRequests} agents. PerSec ${msgsPerSec}  PerMinute ${msgsPerMinute} `)
  })
})
