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
const {
  indyStoreTheirDid,
  indyCreateAndStoreMyDid,
  indyGenerateWalletKey,
  indyOpenWallet,
  indyCreateWallet,
  indyCloseWallet,
  indyDeleteWallet,
  indySetDefaultLogger
} = require('../../src')
const { performance } = require('perf_hooks')
const sleep = require('sleep-promise')
const indy = require('indy-sdk')
const { testsetupWalletStorage } = require('../utils')

const storageType = process.env.STORAGE_TYPE || 'mysql'
const storagePort = process.env.STORAGE_PORT || (storageType === 'mysql') ? 3306 : 5432
const storageHost = process.env.STORAGE_HOST || 'localhost'
let storageConfig
let storageCredentials

let testMode

beforeAll(async () => {
  jest.setTimeout(1000 * 60)
  indySetDefaultLogger('error');
  ({
    testMode,
    storageConfig,
    storageCredentials
  } = await testsetupWalletStorage(storageType, storageHost, storagePort))
})

describe('pgsql wallet', () => {
  async function createAndOpenWallet () {
    const walletKey = await indyGenerateWalletKey()
    const walletName = uuid.v4()
    await indyCreateWallet(walletName, walletKey, 'RAW', storageType, storageConfig, storageCredentials)
    const wh = await indyOpenWallet(walletName, walletKey, 'RAW', storageType, storageConfig, storageCredentials)
    await indyStoreTheirDid(wh, '8wZcEriaNLNKtteJvx7f8i', '~NcYxiDXkpYi6ov5FcYDi1e')
    return { wh, walletKey, walletName, storageConfig, storageCredentials }
  }

  it('should create many DIDs in single wallet', async () => {
    const walletRecord = await createAndOpenWallet()
    try {
      // measure writes
      const PAR_IO = 3000
      await indy.setRuntimeConfig(JSON.stringify({ crypto_thread_pool_size: 8 }))
      await sleep(1000)
      {
        const tStart = performance.now()
        const timeStart = new Date().getTime()
        const { wh } = walletRecord
        const promises = []
        for (let p = 0; p < PAR_IO; p++) {
          if (p % 5 === 0) {
            console.log(`IO ROUND ${p}`)
          }
          promises.push(indyCreateAndStoreMyDid(wh))
        }
        console.log('Waiting for promises to resolve')
        await Promise.all(promises)
        console.log('All resolved!')

        const tFinish = performance.now()
        const timeFinish = new Date().getTime()
        const duration = (tFinish - tStart)
        const totalOps = PAR_IO
        const perOP = duration / totalOps
        console.log(`TYPE:${testMode} -- DID Creates count ${totalOps} operations; took overally: ${duration}ms / ${perOP} per op. StartTime ${timeStart} TimeEnd ${timeFinish}`)
      }
    } finally {
      const { wh, walletKey, walletName, storageConfig, storageCredentials } = walletRecord
      console.log(`Closing wallet starting at ${new Date().getTime()}`)
      await indyCloseWallet(wh)
      console.log(`Deleting wallet starting at ${new Date().getTime()}`)
      await indyDeleteWallet(walletName, storageType, storageConfig, walletKey, 'RAW', storageCredentials)
      console.log(`Deleted wallet at ${new Date().getTime()}`)
    }
  })

  it('should open 300 wallets without crashing', async () => {
    const N = 1
    const PAR = 1
    const walletRecs = []
    try {
      {
        const tStart = performance.now()
        for (let i = 0; i < N; i++) {
          if (i % 5 === 0) {
            console.log(`ROUND ${i}`)
          }
          const promises = []
          for (let p = 0; p < PAR; p++) {
            promises.push(createAndOpenWallet())
          }
          const newWalletRecs = await Promise.all(promises)
          for (const newWalletRec of newWalletRecs) {
            walletRecs.push(newWalletRec)
          }
        }

        const tFinish = performance.now()
        const duration = (tFinish - tStart)
        const totalOps = N * PAR
        const perOP = duration / totalOps
        console.log(`TYPE:${testMode} -- Opening ${totalOps} wallets; ${N}round of ${PAR} operations; took overally: ${duration}ms / ${perOP} per op`)
      }

      // measure writes
      const N_IO = 1
      const PAR_IO = 3000
      await indy.setRuntimeConfig({ crypto_thread_pool_size: 1 })
      {
        const tStart = performance.now()
        const timeStart = new Date().getTime()
        for (let i = 0; i < N_IO; i++) {
          if (i % 5 === 0) {
            console.log(`IO ROUND ${i}`)
          }
          const promises = []
          for (let p = 0; p < PAR_IO; p++) {
            const targetIndex = Math.floor(Math.random() * walletRecs.length)
            const { wh } = walletRecs[targetIndex]
            promises.push(indyCreateAndStoreMyDid(wh))
          }
          await Promise.all(promises)
        }

        const tFinish = performance.now()
        const timeFinish = new Date().getTime()
        const duration = (tFinish - tStart)
        const totalOps = N_IO * PAR_IO
        const perOP = duration / totalOps
        console.log(`TYPE:${testMode} -- DID Creates count ${totalOps}; ${N_IO} round of ${PAR_IO} operations; took overally: ${duration}ms / ${perOP} per op. StartTime ${timeStart} TimeEnd ${timeFinish}`)
      }
    } finally {
      for (let i = 0; i < walletRecs.length; i++) {
        try {
          const walletRecord = walletRecs[i]
          const { wh, walletKey, walletName, storageConfig, storageCredentials } = walletRecord
          console.log(`Closing wallet starting at ${new Date().getTime()}`)
          await indyCloseWallet(wh)
          console.log(`Deleting wallet starting at ${new Date().getTime()}`)
          await indyDeleteWallet(walletName, storageType, storageConfig, walletKey, 'RAW', storageCredentials)
          console.log(`Deleted wallet at ${new Date().getTime()}`)
        } catch (e) {}
      }
    }
  })
})
