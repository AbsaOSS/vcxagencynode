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
const { buildAgencyClientNetwork } = require('../../common')
const { vcxFlowFullOnboarding } = require('vcxagency-client/src')
const { indyGenerateWalletKey } = require('easy-indysdk')
const { indyOpenWallet } = require('easy-indysdk')
const axios = require('axios')

let aliceWalletName
let aliceWalletKey
let aliceDid
let aliceVerkey
let aliceWh

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
  aliceWalletKey = await indyGenerateWalletKey()
  aliceWalletName = `unit-test-${uuid.v4()}`
  await indyCreateWallet(aliceWalletName, aliceWalletKey, WALLET_KDF)
  aliceWh = await indyOpenWallet(aliceWalletName, aliceWalletKey, WALLET_KDF)
  const { did, vkey } = await indyCreateAndStoreMyDid(aliceWh)
  aliceDid = did
  aliceVerkey = vkey
})

afterEach(async () => {
  const homedir = os.homedir()
  const clientWalletPath = `${homedir}/.indy_client/wallet/${aliceWalletName}`
  await rimraf.sync(clientWalletPath)
})

describe('longpoll', () => {
  it('should return HTTP Code 409 when trying to use longpoll on agency of enterprise type', async () => {
    const { agentDid: aliceAgentDid } = await vcxFlowFullOnboarding(aliceWh, sendToAgency, agencyDid, agencyVerkey, aliceDid, aliceVerkey)
    await indyCreateAndStoreMyDid(aliceWh)

    let thrown
    try {
      await axios.get(`${agencyUrl}/experimental/agent/${aliceAgentDid}/notifications`)
    } catch (err) {
      thrown = err
    }
    expect(thrown.response.status).toBe(409)
    expect(thrown.response.data.errorTraceId).toBeDefined()
  })
})
