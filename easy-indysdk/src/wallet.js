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

const indy = require('vdr-tools')
const { indyErrorCodeWalletItemNotFound } = require('./indy-errors')

function indyBuildMysqlStorageCredentials (user, pass) {
  return {
    user,
    pass
  }
}

function indyBuildMysqlStorageConfig (readHost, writeHost, port, dbName, defaultConnectionLimit) {
  return {
    read_host: readHost,
    write_host: writeHost,
    port,
    db_name: dbName,
    default_connection_limit: defaultConnectionLimit
  }
}

function buildWalletConfig (walletId, storageType = 'default', storageConfig = undefined) {
  return JSON.stringify({
    id: walletId,
    storage_type: storageType,
    storage_config: storageConfig
  })
}

function buildWalletCredentials (walletKey, keyDerivationMethod, storageCredentials = undefined) {
  return JSON.stringify({
    key: walletKey,
    key_derivation_method: keyDerivationMethod,
    storage_credentials: storageCredentials
  })
}

async function indyCreateWallet (walletName, walletKey, keyDerivationMethod, storageType = 'default', storageConfig = undefined, storageCredentials = undefined) {
  const walletConfig = buildWalletConfig(walletName, storageType, storageConfig)
  const walletCredentials = buildWalletCredentials(walletKey, keyDerivationMethod, storageCredentials)
  await indy.createWallet(walletConfig, walletCredentials)
}

async function indyAssureWallet (walletName, walletKey, keyDerivationMethod, storageType = 'default', storageConfig = null, storageCredentials = null) {
  try {
    await indyCreateWallet(walletName, walletKey, keyDerivationMethod, storageType, storageConfig, storageCredentials)
  } catch (err) {
    if (err.message !== 'WalletAlreadyExistsError') {
      throw Error(`Unexpected error trying to create a wallet: ${err.message} ${JSON.stringify(err.stack)}`)
    }
  }
}

async function indyOpenWallet (walletName, walletKey, keyDerivationMethod, storageType = 'default', storageConfig = null, storageCredentials = null) {
  const walletConfig = buildWalletConfig(walletName, storageType, storageConfig)
  const walletCredentials = buildWalletCredentials(walletKey, keyDerivationMethod, storageCredentials)
  return indy.openWallet(walletConfig, walletCredentials)
}

async function indyDeleteWallet (walletName, walletKey, keyDerivationMethod, storageType = 'default', storageConfig = null, storageCredentials = null) {
  const walletConfig = buildWalletConfig(walletName, storageType, storageConfig, storageConfig)
  const walletCredentials = buildWalletCredentials(walletKey, keyDerivationMethod, storageCredentials)
  await indy.deleteWallet(walletConfig, walletCredentials)
}

async function indyCloseWallet (wh) {
  await indy.closeWallet(wh)
}

async function indyCreateAndStoreMyDid (wh, requestedDid, seed) {
  const [did, vkey] = await indy.createAndStoreMyDid(wh, JSON.stringify({ did: requestedDid, seed }))
  return {
    did, vkey
  }
}

function indyGenerateWalletKey (optionalSeed) {
  return indy.generateWalletKey(optionalSeed ? { seed: optionalSeed } : undefined)
}

async function indyDidExists (wh, did) {
  try {
    await indy.getMyDidWithMeta(wh, did)
  } catch (err) {
    if (err.message === indyErrorCodeWalletItemNotFound) {
      return false
    } else {
      throw err
    }
  }
  return true
}

async function indyStoreTheirDid (wh, did, verkey = undefined) {
  await indy.storeTheirDid(wh, JSON.stringify({ did, verkey }))
}

async function indyCreatePairwise (wh, theirDid, myDid, metadata) {
  await indy.createPairwise(wh, theirDid, myDid, metadata)
}

async function indyKeyForLocalDid (wh, did) {
  return indy.keyForLocalDid(wh, did)
}

async function indyListPairwise (wh) {
  return indy.listPairwise(wh)
}

async function indyListMyDidsWithMeta (wh) {
  return indy.listMyDidsWithMeta(wh)
}

module.exports = {
  indyAssureWallet,
  indyGenerateWalletKey,
  indyDeleteWallet,
  indyCreateWallet,
  indyOpenWallet,
  indyCloseWallet,
  indyCreateAndStoreMyDid,
  indyStoreTheirDid,
  indyDidExists,
  indyCreatePairwise,
  indyListPairwise,
  indyListMyDidsWithMeta,
  indyKeyForLocalDid,
  indyBuildMysqlStorageCredentials,
  indyBuildMysqlStorageConfig
}
