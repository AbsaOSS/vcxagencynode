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

const { anonCrypt, indyOpenWallet, indyCreateWallet } = require('easy-indysdk')
const uuid = require('uuid')

async function createAnoncryptWallet () {
  const walletName = `unittest-anoncrypyting-wallet-${uuid.v4()}`
  const walletKey = 'CUUz1xrqVeJQTx1bUyMiW3v1j2kEF8koUcoYSYdSQT7t'
  const walletKdf = 'RAW'
  try {
    await indyCreateWallet(walletName, walletKey, walletKdf)
  } catch (err) {}
  const anoncryptWh = await indyOpenWallet(walletName, walletKey, walletKdf)
  return anoncryptWh
}

/**
 * Builds function which deliver a message to Forward Agent of Agency. This is useful when you want to
 * deliver messages to VCX Agency without having to hook it up to network. You can use this function to simulate
 * sending messages to the agency without having to deal with networking.
 *
 * @param {object} entityForwardAgent - reference to ForwardAgent entity of VCX Agency application
 */
async function buildAgencyClientVirtual (entityForwardAgent) {
  const anoncryptWh = await createAnoncryptWallet()
  const { verkey: agencyVerkey } = await getAgencyInfo()

  async function getAgencyInfo () {
    const { verkey, did } = await entityForwardAgent.getForwadAgentInfo()
    return { verkey, did }
  }

  async function sendToAgency (msgBuffer) {
    const msgForAgencyBuffer = await anonCrypt(anoncryptWh, msgBuffer, agencyVerkey)
    const res = await entityForwardAgent.handleIncomingMessage(msgForAgencyBuffer)
    if (res.errorMsg) {
      throw Error(res.errorMsg)
    }
    return res
  }

  return {
    sendToAgency,
    getAgencyInfo
  }
}

function getBaseAppConfig(agencyWalletName, agencyDid, agencySeed, agencyWalletKey, redisUrl, pgUrl) {
  return {
    AGENCY_WALLET_NAME: agencyWalletName,
    AGENCY_DID: agencyDid,
    AGENCY_SEED_SECRET: agencySeed,
    AGENCY_WALLET_KEY_SECRET: agencyWalletKey,

    REDIS_URL: redisUrl,
    AGENCY_TYPE: redisUrl ? 'client' : 'enterprise',

    PG_WALLET_ACCOUNT: 'postgres',
    PG_WALLET_PASSWORD_SECRET: 'mysecretpassword',
    PG_WALLET_ADMIN_ACCOUNT: 'postgres',
    PG_WALLET_ADMIN_PASSWORD_SECRET: 'mysecretpassword',
    PG_WALLET_URL: pgUrl,
    PG_WALLET_MIN_IDLE_COUNT: process.env.PG_WALLET_MIN_IDLE_COUNT || 0,
    PG_WALLET_MAX_CONNECTIONS: process.env.PG_WALLET_MAX_CONNECTIONS || 90,
    PG_WALLET_CONNECTION_TIMEOUT_MINS: process.env.PG_WALLET_CONNECTION_TIMEOUT_MINS || 5,
  }
}

module.exports = {
  buildAgencyClientVirtual,
  getBaseAppConfig
}
