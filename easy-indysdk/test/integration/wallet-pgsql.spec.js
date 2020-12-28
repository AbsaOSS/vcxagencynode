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
const uuid = require('uuid')
const rimraf = require('rimraf')
const os = require('os')
const { indyGenerateWalletKey } = require('../../src')
const { indyOpenWallet } = require('../../src')
const { indyCreateWallet } = require('../../src')
const { indyStoreTheirDid } = require('../../src')
const { indyKeyForLocalDid } = require('../../src')
const { indyCloseWallet } = require('../../src')
const { indyDeleteWallet } = require('../../src')
const { indyLoadPostgresPlugin } = require('../../src')
const { indyBuildPostgresCredentials } = require('../../src')
const { indyBuildPostgresStorageConfig } = require('../../src')

beforeAll(async () => {
  jest.setTimeout(1000 * 40)
})
const storageType = 'postgres_storage'
const storageConfig = indyBuildPostgresStorageConfig('localhost:5432', 90, 30, 'MultiWalletSingleTableSharedPool')
const storageCredentials = indyBuildPostgresCredentials('postgres', 'mysecretpassword', 'postgres', 'mysecretpassword')

describe('pgsql wallet', () => {
  it('should create wallet store their did and retrieve it', async () => {
    await indyLoadPostgresPlugin(storageConfig, storageCredentials)
    const walletName = uuid.v4()
    const walletKey = await indyGenerateWalletKey()
    await indyCreateWallet(walletName, walletKey, 'RAW', storageType, storageConfig, storageCredentials)
    const wh = await indyOpenWallet(walletName, walletKey, 'RAW', storageType, storageConfig, storageCredentials)
    await indyStoreTheirDid(wh, '8wZcEriaNLNKtteJvx7f8i', '~NcYxiDXkpYi6ov5FcYDi1e')

    // Replace
    const loadedVkey = await indyKeyForLocalDid(wh, '8wZcEriaNLNKtteJvx7f8i')
    expect(loadedVkey).toBe('5L2HBnzbu6Auh2pkDRbFt5f4prvgE2LzknkuYLsKkacp')
    await indyCloseWallet(wh)
    const homedir = os.homedir()
    const walletPath = `${homedir}/.indy_client/wallet/${walletName}`
    await rimraf.sync(walletPath)
  })

  async function createAndOpenWallet () {
    const walletKey = await indyGenerateWalletKey()
    const walletName = uuid.v4()
    await indyCreateWallet(walletName, walletKey, 'RAW', storageType, storageConfig, storageCredentials)
    const wh = await indyOpenWallet(walletName, walletKey, 'RAW', storageType, storageConfig, storageCredentials)
    await indyStoreTheirDid(wh, '8wZcEriaNLNKtteJvx7f8i', '~NcYxiDXkpYi6ov5FcYDi1e')
    return { wh, walletKey, walletName, storageConfig, storageCredentials }
  }

  it('should open 500 wallets without crashing', async () => {
    const walletRecs = []
    try {
      await indyLoadPostgresPlugin(storageConfig, storageCredentials)
      for (let i = 0; i < 100; i++) {
        const promises = []
        promises.push(createAndOpenWallet())
        promises.push(createAndOpenWallet())
        promises.push(createAndOpenWallet())
        promises.push(createAndOpenWallet())
        promises.push(createAndOpenWallet())
        const [r1, r2, r3, r4, r5] = await Promise.all(promises)
        walletRecs.push(r1)
        walletRecs.push(r2)
        walletRecs.push(r3)
        walletRecs.push(r4)
        walletRecs.push(r5)
      }
    } finally {
      for (let i = 0; i < walletRecs.length; i++) {
        try {
          const walletRecord = walletRecs[i]
          const { wh, walletKey, walletName, storageConfig, storageCredentials } = walletRecord
          await indyCloseWallet(wh)
          await indyDeleteWallet(walletName, storageType, storageConfig, walletKey, 'RAW', storageCredentials)
        } catch (e) {}
      }
    }
  })
})
