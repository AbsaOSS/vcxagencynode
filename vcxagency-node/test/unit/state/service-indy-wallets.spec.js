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
global.LOG_LEVEL = process.env.LOG_LEVEL || 'info'
global.LOG_JSON_TO_CONSOLE = process.env.LOG_JSON_TO_CONSOLE === 'true'
global.SILENT_WINSTON = process.env.SILENT_WINSTON === 'false'

/* eslint-env jest */
const { indyOpenWallet, indyCloseWallet, indyListMyDidsWithMeta } = require('easy-indysdk')
const uuid = require('uuid')
const { createServiceIndyWallets } = require('../../../src/service/state/service-indy-wallets')
const os = require('os')
const rimraf = require('rimraf')

let walletsService
let walletName

beforeAll(async () => {
  walletsService = await createServiceIndyWallets()
})

beforeEach(async () => {
  walletName = `unittest-${uuid.v4()}`
})

afterEach(async () => {
  const homedir = os.homedir()
  const clientWalletPath = `${homedir}/.indy_client/wallet/${walletName}`
  await rimraf.sync(clientWalletPath)
})

describe('wallet service', () => {
  it('should create new raw wallet with did and verkey', async () => {
    // act
    const { walletKey, wh, entityDid, entityVkey } = await walletsService.createNewRawWalletForEntity(walletName)

    expect(walletKey).toBeDefined()
    expect(wh).toBeDefined()
    expect(entityDid).toBeDefined()
    expect(entityVkey).toBeDefined()

    const myDids = await indyListMyDidsWithMeta(wh)
    expect(myDids.length).toBe(1)
    expect(myDids[0].did).toBe(entityDid)
    expect(myDids[0].verkey).toBe(entityVkey)

    await indyCloseWallet(wh)

    const newWh = await indyOpenWallet(walletName, walletKey, 'RAW')
    expect(newWh).toBeDefined()
  })
})
