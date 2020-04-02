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

const { indyGenerateWalletKey, indyCreateAndStoreMyDid, indyCreateWallet, indyAssureWallet, indyOpenWallet } = require('easy-indysdk')

/**
 * Creates object for managing indy wallet handles. As a consumer of this interface you should not preserve wallet handles
 * for extended amount of time but rather request wallet handle for specific wallet whenever you need it.
 * Wallet handles are cached so requesting wallet handle for a wallet is generally cheap.
 */
async function createServiceIndyWallets (storageType = 'default', storageConfig, storageCredentials) {
  const openWalletHandlesCache = {}

  async function assureWallet (walletName, walletKey, keyDerivationMethod) {
    await indyAssureWallet(walletName, walletKey, keyDerivationMethod, storageType, storageConfig, storageCredentials)
  }

  /*
  Don't keep the instance, always request the wallet service when needed. Wallet service might be released (closing wallet
  on long inactivity, deletion of agent and its wallet etc.)
   */
  async function getWalletHandle (walletName, walletKey, keyDerivationMethod) {
    let wh = openWalletHandlesCache[walletName]
    if (wh) {
      return wh
    }
    wh = await indyOpenWallet(walletName, walletKey, keyDerivationMethod, storageType, storageConfig, storageCredentials)
    openWalletHandlesCache[walletName] = wh
    return wh
  }

  async function createNewRawWalletForEntity (walletName) {
    const keyDerivationMethod = 'RAW'
    const walletKey = await indyGenerateWalletKey()
    await indyCreateWallet(walletName, walletKey, keyDerivationMethod, storageType, storageConfig, storageCredentials)
    const wh = await getWalletHandle(walletName, walletKey, keyDerivationMethod)
    const { did: entityDid, vkey: entityVkey } = await indyCreateAndStoreMyDid(wh)
    return { walletKey, wh, entityDid, entityVkey }
  }

  return {
    assureWallet,
    getWalletHandle,
    createNewRawWalletForEntity
  }
}

module.exports = { createServiceIndyWallets }
