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
const { createTestPgDb } = require('../../../pg-tmpdb')
const { createPgStorageEntities } = require('../../../../src/service/storage/pgstorage-entities')
const { indyGenerateWalletKey } = require('easy-indysdk')
const { buildAgentAO, createAgentData } = require('../../../../src/service/entities/agent/agent')
const { createServiceIndyWallets } = require('../../../../src/service/state/service-indy-wallets')
const { indyOpenWallet } = require('easy-indysdk')

let serviceIndyWallets
let serviceStorage

let clientWalletName
let clientWalletKey
let clientDid
let clientVerkey
let clientWh

beforeAll(async () => {
  jest.setTimeout(1000 * 10)
  serviceIndyWallets = await createServiceIndyWallets(undefined)
  const { info } = await createTestPgDb()
  serviceStorage = await createPgStorageEntities(info)
})

beforeEach(async () => {
  clientWalletKey = await indyGenerateWalletKey()
  clientWalletName = `unit-test-${uuid.v4()}`
  await indyCreateWallet(clientWalletName, clientWalletKey, 'RAW')
  clientWh = await indyOpenWallet(clientWalletName, clientWalletKey, 'RAW')
  const { did, vkey } = await indyCreateAndStoreMyDid(clientWh)
  clientDid = did
  clientVerkey = vkey
})

afterEach(async () => {
  const homedir = os.homedir()
  const clientWalletPath = `${homedir}/.indy_client/wallet/${clientWalletName}`
  await rimraf.sync(clientWalletPath)
})

describe('agent operations', () => {
  it('should create agent data and retrieve entity record', async () => {
    const { agentDid, agentVerkey } = await createAgentData(clientDid, clientVerkey, serviceIndyWallets, serviceStorage)
    expect(agentDid).toBeDefined()
    expect(agentVerkey).toBeDefined()
    const entityRecord = await serviceStorage.loadEntityRecord(agentDid)
    const entityRecordByVkey = await serviceStorage.loadEntityRecord(agentVerkey)
    expect(entityRecord).toStrictEqual(entityRecordByVkey)
  })

  it('should create agent data and retrieve wallet information', async () => {
    const { agentDid: agentDidOnCreate, agentVerkey: agentVkeyOnCreate } = await createAgentData(clientDid, clientVerkey, serviceIndyWallets, serviceStorage)
    const entityRecord = await serviceStorage.loadEntityRecord(agentDidOnCreate)
    const agentAo = await buildAgentAO(entityRecord, serviceIndyWallets, serviceStorage)
    const { ownerDid, ownerVerkey, agentDid, agentVerkey } = await agentAo.loadInfo()

    expect(ownerDid).toBe(clientDid)
    expect(ownerVerkey).toBe(clientVerkey)
    expect(agentDid).toBe(agentDidOnCreate)
    expect(agentVerkey).toBe(agentVkeyOnCreate)
  })
})
