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
const { createDbSchemaApplication } = require('dbutils')
const { createDataStorage } = require('../../../../src/service/storage/storage')
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
  const { info } = await createDbSchemaApplication()
  serviceStorage = await createDataStorage(info)
})

afterAll(async () => {
  serviceStorage.cleanUp()
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
    const entityRecord = await serviceStorage.loadEntityRecordByDidOrVerkey(agentDid)
    const entityRecordByVkey = await serviceStorage.loadEntityRecordByDidOrVerkey(agentVerkey)
    expect(entityRecord).toStrictEqual(entityRecordByVkey)
  })

  it('should create agent data and retrieve wallet information', async () => {
    const { agentDid: agentDidOnCreate, agentVerkey: agentVkeyOnCreate } = await createAgentData(clientDid, clientVerkey, serviceIndyWallets, serviceStorage)
    const entityRecord = await serviceStorage.loadEntityRecordByDidOrVerkey(agentDidOnCreate)
    const agentAo = await buildAgentAO(entityRecord, serviceIndyWallets, serviceStorage)
    const { ownerDid, ownerVerkey, agentDid, agentVerkey } = await agentAo.loadInfo()

    expect(ownerDid).toBe(clientDid)
    expect(ownerVerkey).toBe(clientVerkey)
    expect(agentDid).toBe(agentDidOnCreate)
    expect(agentVerkey).toBe(agentVkeyOnCreate)
  })

  it('should set and get http/https webhook', async () => {
    const { agentDid: agentDidOnCreate } = await createAgentData(clientDid, clientVerkey, serviceIndyWallets, serviceStorage)
    const entityRecord = await serviceStorage.loadEntityRecordByDidOrVerkey(agentDidOnCreate)
    const agentAo = await buildAgentAO(entityRecord, serviceIndyWallets, serviceStorage)

    await agentAo.setWebhook('http://1.2.3.4:3000')
    expect(await agentAo.getWebhook()).toBe('http://1.2.3.4:3000')

    await agentAo.setWebhook('https://example.org/123213123')
    expect(await agentAo.getWebhook()).toBe('https://example.org/123213123')
  })

  it('should unset webhook by using empty string', async () => {
    const { agentDid: agentDidOnCreate } = await createAgentData(clientDid, clientVerkey, serviceIndyWallets, serviceStorage)
    const entityRecord = await serviceStorage.loadEntityRecordByDidOrVerkey(agentDidOnCreate)
    const agentAo = await buildAgentAO(entityRecord, serviceIndyWallets, serviceStorage)

    await agentAo.setWebhook('http://example.org/123213123')
    await agentAo.setWebhook('')

    expect(await agentAo.getWebhook()).toBe(null)
  })

  it('should throw if webhook is not http or https', async () => {
    const { agentDid: agentDidOnCreate } = await createAgentData(clientDid, clientVerkey, serviceIndyWallets, serviceStorage)
    const entityRecord = await serviceStorage.loadEntityRecordByDidOrVerkey(agentDidOnCreate)
    const agentAo = await buildAgentAO(entityRecord, serviceIndyWallets, serviceStorage)

    let thrown
    try {
      await agentAo.setWebhook('ftp://example.org/123213123')
    } catch (err) {
      thrown = err
    }

    expect(thrown.message).toMatch(/must be specify http or https protocol/i)
  })
})
