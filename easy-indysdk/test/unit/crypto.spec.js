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
const { pack } = require('../../src')
const { indyCloseWallet } = require('../../src')
const { Buffer } = require('safe-buffer')

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

describe('pack unpack', () => {
  it('should return Buffer from pack', async () => {
    const walletKey = await indyGenerateWalletKey()
    await indyCreateWallet(walletName, walletKey, 'RAW')
    const wh = await indyOpenWallet(walletName, walletKey, 'RAW')
    const { vkey } = await indyCreateAndStoreMyDid(wh)
    const message = { foo: 'bar' }
    const res = await pack(wh, Buffer.from(JSON.stringify(message)), ['8pPbkSVwHyFCy4D8hC6zrhFhAfcovFZcp7EFaezBUXPh'], vkey)
    expect(Buffer.isBuffer(res)).toBeTruthy()
    expect(JSON.parse(res.toString('utf8')).protected).toBeDefined()
    expect(JSON.parse(res.toString('utf8')).iv).toBeDefined()
    expect(JSON.parse(res.toString('utf8')).ciphertext).toBeDefined()
    expect(JSON.parse(res.toString('utf8')).tag).toBeDefined()
    await indyCloseWallet(wh)
  })
})
