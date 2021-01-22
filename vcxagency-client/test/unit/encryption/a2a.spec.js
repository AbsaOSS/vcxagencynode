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
const { parseAuthcrypted, parseAnoncrypted } = require('../../../src')
const { indyOpenWallet } = require('easy-indysdk')
const { pack } = require('easy-indysdk')
const { Buffer } = require('safe-buffer')

let aliceWalletName
const aliceWalletKey = 'key'
let aliceDid // eslint-disable-line
let aliceVerkey
let aliceWh

let bobWalletName
const bobWalletKey = 'key'
let bobDid // eslint-disable-line
let bobVerkey
let bobWh

beforeAll(async () => {
  jest.setTimeout(1000 * 10)
})

async function createWalletWithDid (walletName, walletKey) {
  await indyCreateWallet(walletName, walletKey)
  const wh = await indyOpenWallet(walletName, walletKey)
  const { did, vkey } = await indyCreateAndStoreMyDid(wh)
  return { wh, did, vkey }
}

beforeEach(async () => {
  const testRunId = uuid.v4()
  aliceWalletName = `unit-test-alice-${testRunId}`
  bobWalletName = `unit-test-bob-${testRunId}`
  {
    const { wh, did, vkey } = await createWalletWithDid(aliceWalletName, aliceWalletKey)
    aliceDid = did
    aliceVerkey = vkey
    aliceWh = wh
  }
  {
    const { wh, did, vkey } = await createWalletWithDid(bobWalletName, bobWalletKey)
    bobDid = did
    bobVerkey = vkey
    bobWh = wh
  }
})

afterEach(async () => {
  const homedir = os.homedir()
  const aliceWalletPath = `${homedir}/.indy_client/wallet/${aliceWalletName}`
  const bobWalletPath = `${homedir}/.indy_client/wallet/${bobWalletName}`
  await rimraf.sync(aliceWalletPath)
  await rimraf.sync(bobWalletPath)
})

describe('packing unpacking', () => {
  it('should unpack anoncrypted message', async () => {
    const messageBuffer = Buffer.from(JSON.stringify({ content: 'Hello Bob, Sincerely Alice.' }))
    const anoncryptedMsg = await pack(aliceWh, messageBuffer, bobVerkey, undefined)
    const parsedMsg = await parseAnoncrypted(bobWh, anoncryptedMsg)
    expect(parsedMsg.content).toBe('Hello Bob, Sincerely Alice.')
  })

  it('should unpack authcrypted message', async () => {
    const messageBuffer = Buffer.from(JSON.stringify({ content: 'Hello Bob, Sincerely Alice.' }))
    const anoncryptedMsg = await pack(aliceWh, messageBuffer, bobVerkey, aliceVerkey)
    const { message, senderVerkey } = await parseAuthcrypted(bobWh, anoncryptedMsg)
    expect(message.content).toBe('Hello Bob, Sincerely Alice.')
    expect(senderVerkey).toBe(aliceVerkey)
  })
})
