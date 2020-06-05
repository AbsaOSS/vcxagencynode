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
const { loadPairwiseData } = require('../../../src/service/entities/entities-common')
const { savePairwiseData } = require('../../../src/service/entities/entities-common')
const { indyGenerateWalletKey } = require('easy-indysdk')
const { indyOpenWallet } = require('easy-indysdk')

let clientWalletName
let clientWalletKey
let clientDid
let clientWh

beforeEach(async () => {
  clientWalletKey = await indyGenerateWalletKey()
  clientWalletName = `unit-test-${uuid.v4()}`
  await indyCreateWallet(clientWalletName, clientWalletKey, 'RAW')
  clientWh = await indyOpenWallet(clientWalletName, clientWalletKey, 'RAW')
  const { did } = await indyCreateAndStoreMyDid(clientWh)
  clientDid = did
})

afterEach(async () => {
  const homedir = os.homedir()
  const clientWalletPath = `${homedir}/.indy_client/wallet/${clientWalletName}`
  await rimraf.sync(clientWalletPath)
})

describe('agent operations', () => {
  it('should create agent and get its did and verkey', async () => {
    await savePairwiseData(clientWh, clientDid, '3zM5TyH1Cgq5gg8wGFitXS', '2dUpCFHEDhfYZiXkg8QgMXQtWbZsjDjydfWfbBbuPorH', 'relation-foo')
    const { ourDid, theirDid, theirVkey } = await loadPairwiseData(clientWh, 'relation-foo')
    expect(ourDid).toBe(clientDid)
    expect(theirDid).toBe('3zM5TyH1Cgq5gg8wGFitXS')
    expect(theirVkey).toBe('2dUpCFHEDhfYZiXkg8QgMXQtWbZsjDjydfWfbBbuPorH')
  })

  it('should return undefined if pairwise relationship is not found by name', async () => {
    await savePairwiseData(clientWh, clientDid, '3zM5TyH1Cgq5gg8wGFitXS', '2dUpCFHEDhfYZiXkg8QgMXQtWbZsjDjydfWfbBbuPorH', 'relation-bar')
    const res = await loadPairwiseData(clientWh, 'relation-foo')
    expect(res).toBeUndefined()
  })
})
