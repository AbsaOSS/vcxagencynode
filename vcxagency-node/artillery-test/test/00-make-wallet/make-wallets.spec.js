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

const os = require('os')
const { indyCreateWallet } = require('easy-indysdk')
const rimraf = require('rimraf')
const config = require('../config')

const WALLET_KEY = 'skt'
const WALLET_KDF = 'ARGON2I_MOD'

beforeAll(async () => {
  jest.setTimeout(1000 * 180)
})

const mkWallet = async (walletName) => {
  try {
    await indyCreateWallet(walletName, WALLET_KEY, WALLET_KDF)
  } catch (err) {
    console.log(`make wallet: ${walletName}:`, err)
  }
}

describe('prepare wallets', () => {
  it('should remove existing wallets', async () => {
    const homeDir = os.homedir()
    const walletHome = `${homeDir}/.indy_client/wallet`
    await rimraf.sync(`${walletHome}/${config.TestName}*`)
  })

  it('should create new wallets', async () => {
    let i
    for (i=0; i<config.AliceNumber; i++) {
      await mkWallet(config.getAliceName(i))
    }
    for (i=0; i<config.FaberNumber; i++) {
      await mkWallet(config.getFaberName(i))
    }
  })
})
