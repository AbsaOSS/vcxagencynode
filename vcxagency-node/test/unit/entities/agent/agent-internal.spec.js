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
const os = require('os')
const rimraf = require('rimraf')
const { indyListMyDidsWithMeta } = require('easy-indysdk')
const { indyKeyForLocalDid } = require('easy-indysdk')
const { createAgentWallet } = require('../../../../src/service/entities/agent/agent-internal')
const { indyGenerateWalletKey } = require('easy-indysdk')
const { createServiceIndyWallets } = require('../../../../src/service/state/service-indy-wallets')
const { indyOpenWallet } = require('easy-indysdk')

let serviceIndyWallets

let clientWalletName
let clientWalletKey
let clientWh

let utilWalletWh

beforeAll(async () => {
  jest.setTimeout(1000 * 10)
  serviceIndyWallets = await createServiceIndyWallets(undefined)
  try {
    await indyCreateWallet('util-test', '513W5fBThtzCMvNQ6qbyJDfdQijTyTfDkXTDXNubbQg4', 'RAW')
  } catch (err) { }
  utilWalletWh = await indyOpenWallet('util-test', '513W5fBThtzCMvNQ6qbyJDfdQijTyTfDkXTDXNubbQg4', 'RAW')
})

afterAll(async () => {
  const homedir = os.homedir()
  const clientWalletPath = `${homedir}/.indy_client/wallet/util-test`
  await rimraf.sync(clientWalletPath)
})

beforeEach(async () => {
  clientWalletKey = await indyGenerateWalletKey()
  clientWalletName = `unit-test-${uuid.v4()}`
  await indyCreateWallet(clientWalletName, clientWalletKey, 'RAW')
  clientWh = await indyOpenWallet(clientWalletName, clientWalletKey, 'RAW')
  await indyCreateAndStoreMyDid(clientWh)
})

afterEach(async () => {
  const homedir = os.homedir()
  const clientWalletPath = `${homedir}/.indy_client/wallet/${clientWalletName}`
  await rimraf.sync(clientWalletPath)
})

async function generateDidVerkey () {
  const { did } = await indyCreateAndStoreMyDid(utilWalletWh)
  const verkey = await indyKeyForLocalDid(utilWalletWh, did)
  return { did, verkey }
}

describe('agent operations', () => {
  it('should create agent wallet and load agent\'s did,vkey information', async () => {
    const { did: ownerDid } = await generateDidVerkey()
    const { wh, walletName, agentDid: createdDid, agentVerkey: createdVkey } = await createAgentWallet(serviceIndyWallets, ownerDid)
    clientWalletName = walletName
    const myDids = await indyListMyDidsWithMeta(wh)
    expect(myDids.length).toBe(1)
    const { did: agentDid, verkey: agentVerkey } = myDids[0]
    expect(agentDid).toBe(createdDid)
    expect(agentVerkey).toBe(createdVkey)
  })
})
