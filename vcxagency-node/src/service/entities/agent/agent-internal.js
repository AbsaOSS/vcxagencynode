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

/**
 * Creates new agent wallet containing all information identifying the agent
 * @param {object} serviceWallets - Service for indy wallet management interface
 */
async function createAgentWallet (serviceWallets, ownerDid) {
  const walletName = `agent_${ownerDid}`
  const { walletKey, wh, entityDid: agentDid, entityVkey: agentVerkey } =
    await serviceWallets.createNewRawWalletForEntity(`agent_${ownerDid}`)
  return { wh, walletName, walletKey, agentDid, agentVerkey }
}

module.exports = { createAgentWallet }
