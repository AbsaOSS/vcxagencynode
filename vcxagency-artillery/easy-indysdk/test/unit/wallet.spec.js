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
const { indyOpenWallet, indyCreateWallet, indyCreateAndStoreMyDid } = require('../../src')
const uuid = require('uuid')
const rimraf = require('rimraf')
const os = require('os')
const { indyGenerateWalletKey } = require('../../src')
const indy = require('indy-sdk')
const { indyDidExists } = require('../../src')
const { indyStoreTheirDid } = require('../../src')
const { indyKeyForLocalDid } = require('../../src')
const { indyCloseWallet } = require('../../src')
const { indyAssureWallet } = require('../../src')

let walletName

beforeAll(async () => {
  jest.setTimeout(1000 * 5)
})

beforeEach(async () => {
  walletName = uuid.v4()
})

afterEach(async () => {
  const homedir = os.homedir()
  const walletPath = `${homedir}/.indy_client/wallet/${walletName}`
  await rimraf.sync(walletPath)
})

describe('wallet with RAW kdf', () => {
  it('should create wallet if doesnt exists', async () => {
    const walletKey = await indyGenerateWalletKey()
    await indyAssureWallet(walletName, walletKey, 'RAW')
    const wh = await indyOpenWallet(walletName, walletKey, 'RAW')
    await indyCloseWallet(wh)
  })

  it('should be possible to call indyAssureWallet repeatedly', async () => {
    const walletKey = await indyGenerateWalletKey()
    await indyAssureWallet(walletName, walletKey, 'RAW')
    await indyAssureWallet(walletName, walletKey, 'RAW')
    const wh = await indyOpenWallet(walletName, walletKey, 'RAW')
    await indyAssureWallet(walletName, walletKey, 'RAW')
    await indyCloseWallet(wh)
    await indyAssureWallet(walletName, walletKey, 'RAW')
  })

  it('should generate RAW wallet key and use it create wallet', async () => {
    const walletKey = await indyGenerateWalletKey()
    await indyCreateWallet(walletName, walletKey, 'RAW')
    const wh = await indyOpenWallet(walletName, walletKey, 'RAW')
    await indyCloseWallet(wh)
  })

  it('should rotate key of my did', async () => {
    const walletKey = await indyGenerateWalletKey()
    await indyCreateWallet(walletName, walletKey, 'RAW')
    const wh = await indyOpenWallet(walletName, walletKey, 'RAW')
    const { did } = await indyCreateAndStoreMyDid(wh)

    // Replace
    const vkeyNew = await indy.replaceKeysStart(wh, did, {})
    await indy.replaceKeysApply(wh, did)
    const vkeyResolved = await indy.keyForLocalDid(wh, did)
    expect(vkeyResolved).toBe(vkeyNew)
    await indyCloseWallet(wh)
  })

  it('should store their did and retrieve it', async () => {
    const walletKey = await indyGenerateWalletKey()
    await indyCreateWallet(walletName, walletKey, 'RAW')
    const wh = await indyOpenWallet(walletName, walletKey, 'RAW')
    await indyStoreTheirDid(wh, '8wZcEriaNLNKtteJvx7f8i', '~NcYxiDXkpYi6ov5FcYDi1e')

    // Replace
    const loadedVkey = await indyKeyForLocalDid(wh, '8wZcEriaNLNKtteJvx7f8i')
    expect(loadedVkey).toBe('5L2HBnzbu6Auh2pkDRbFt5f4prvgE2LzknkuYLsKkacp')
    await indyCloseWallet(wh)
  })

  it('should determine whether did exists or not', async () => {
    const walletKey = await indyGenerateWalletKey()
    await indyCreateWallet(walletName, walletKey, 'RAW')
    const wh = await indyOpenWallet(walletName, walletKey, 'RAW')

    const did = '8wZcEriaNLNKtteJvx7f8i'
    expect(await indyDidExists(wh, did)).toBe(false)
    await indyCreateAndStoreMyDid(wh, did)
    expect(await indyDidExists(wh, did)).toBe(true)
  })
})
