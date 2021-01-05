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
const { buildAgentConnectionAO, createAgentConnectionData } = require('../../../../src/service/entities/agent-connection/agent-connection')
const { indyGenerateWalletKey } = require('easy-indysdk')
const { createServiceIndyWallets } = require('../../../../src/service/state/service-indy-wallets')
const { indyOpenWallet } = require('easy-indysdk')

let serviceIndyWallets
let serviceStorage

let clientWalletName
let clientWalletKey
let clientDid
let clientVerkey
let clientWh

let clientPairwiseDid
let clientPairwiseVkey

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

  const { did: did2, vkey: vkey2 } = await indyCreateAndStoreMyDid(clientWh)
  clientPairwiseDid = did2
  clientPairwiseVkey = vkey2
})

afterAll(async () => {
  serviceStorage.cleanUp()
})

afterEach(async () => {
  const homedir = os.homedir()
  const clientWalletPath = `${homedir}/.indy_client/wallet/${clientWalletName}`
  await rimraf.sync(clientWalletPath)
})

describe('agent operations', () => {
  it('should create agentConnection data and retrieve entity record', async () => {
    const { agentConnectionDid, agentConnectionVerkey } = await createAgentConnectionData('LC9mkrzZfDXb3UwjnBnm89', clientDid, clientVerkey, clientPairwiseDid, clientPairwiseVkey, serviceIndyWallets, serviceStorage)
    const entityRecord = await serviceStorage.loadEntityRecordByDidOrVerkey(agentConnectionDid)
    const entityRecordByVkey = await serviceStorage.loadEntityRecordByDidOrVerkey(agentConnectionVerkey)
    expect(entityRecord).toStrictEqual(entityRecordByVkey)
  })

  it('should create agentConnection data and build AO', async () => {
    const { agentConnectionDid, agentConnectionVerkey } = await createAgentConnectionData('LC9mkrzZfDXb3UwjnBnm89', clientDid, clientVerkey, clientPairwiseDid, clientPairwiseVkey, serviceIndyWallets, serviceStorage)
    const entityRecord = await serviceStorage.loadEntityRecordByDidOrVerkey(agentConnectionDid)

    const agentAo = await buildAgentConnectionAO(entityRecord, serviceIndyWallets, serviceStorage)
    const info = await agentAo.loadInfo()
    expect(info.agentConnectionDid).toBe(agentConnectionDid)
    expect(info.agentConnectionVerkey).toBe(agentConnectionVerkey)

    const ownerInfo = await agentAo.loadOwnerInfo()
    expect(ownerInfo.ownerDid).toBe(clientDid)
    expect(ownerInfo.ownerVerkey).toBe(clientVerkey)

    const pwInfo = await agentAo.loadUserPairwiseInfo()
    expect(pwInfo.userPairwiseDid).toBe(clientPairwiseDid)
    expect(pwInfo.userPairwiseVerkey).toBe(clientPairwiseVkey)
  })
})
