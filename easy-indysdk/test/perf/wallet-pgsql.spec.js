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
  indySetDefaultLogger
} = require('../../src')
const { performance } = require('perf_hooks')
const sleep = require('sleep-promise')
const indy = require('indy-sdk')
const { indyBuildMysqlStorageConfig, indyBuildMysqlStorageCredentials } = require('../../src')
const { createDbSchemaWallets } = require('../../../dbutils')

let walletStorageConfig
let walletStorageCredentials

const storageType = 'mysql'
let tmpDbWallet

function getStorageInfoMysql (dbSchemaWallet) {
  const walletStorageConfig = indyBuildMysqlStorageConfig(
    'localhost',
    'localhost',
    3306,
    dbSchemaWallet,
    20
  )
  const walletStorageCredentials = indyBuildMysqlStorageCredentials(
    'root',
    'mysecretpassword'
  )
  return {
    walletStorageType: 'mysql',
    walletStorageConfig,
    walletStorageCredentials
  }
}

beforeAll(() => {
  jest.setTimeout(1000 * 60)
  indySetDefaultLogger('error')
})

beforeEach(async () => {
  const testId = `${uuid.v4()}`.replace(/-/gi, '').substring(0, 6)
  tmpDbWallet = await createDbSchemaWallets(testId);
  ({ walletStorageConfig, walletStorageCredentials } = getStorageInfoMysql(tmpDbWallet.info.database))
})

afterEach(async () => {
  await tmpDbWallet.dropDb()
})

describe('pgsql wallet', () => {
  async function createAndOpenWallet () {
    const walletKey = await indyGenerateWalletKey()
    const walletName = uuid.v4()
    await indyCreateWallet(walletName, walletKey, 'RAW', storageType, walletStorageConfig, walletStorageCredentials)
    const wh = await indyOpenWallet(walletName, walletKey, 'RAW', storageType, walletStorageConfig, walletStorageCredentials)
    await indyStoreTheirDid(wh, '8wZcEriaNLNKtteJvx7f8i', '~NcYxiDXkpYi6ov5FcYDi1e')
    return { wh, walletKey, walletName, storageConfig: walletStorageConfig, storageCredentials: walletStorageCredentials }
  }

  it('should measure IO, parallel within single wallet', async () => {
    const walletRecord = await createAndOpenWallet()
    try {
      // measure writes
      const PAR_IO = 100
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
        console.log(`DID Creates count ${totalOps} operations; took overally: ${duration}ms / ${perOP} per op. StartTime ${timeStart} TimeEnd ${timeFinish}`)
      }
    } finally {
      await indyCloseWallet(walletRecord.wh)
    }
  })

  it('should measure IO, parallel across various wallets', async () => {
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
        console.log(`Opening ${totalOps} wallets; ${N}round of ${PAR} operations; took overally: ${duration}ms / ${perOP} per op`)
      }

      // measure writes
      const N_IO = 1
      const PAR_IO = 3000
      await indy.setRuntimeConfig({ crypto_thread_pool_size: 4 })
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
        console.log(`DID Creates count ${totalOps}; ${N_IO} round of ${PAR_IO} operations; took overally: ${duration}ms / ${perOP} per op. StartTime ${timeStart} TimeEnd ${timeFinish}`)
      }
    } finally {
      for (let i = 0; i < walletRecs.length; i++) {
        try {
          const walletRecord = walletRecs[i]
          await indyCloseWallet(walletRecord.wh)
        } catch (e) {}
      }
    }
  })
})
