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

const { savePairwiseData } = require('../entities-common')

async function createAgentConnectionWallet (serviceWallets, userPairwiseDid, userPairwiseVerkey) {
  const walletName = `agentconn_${userPairwiseDid}`
  const { walletKey, wh, entityDid: agentConnectionDid, entityVkey: agentConnectionVerkey } =
    await serviceWallets.createNewRawWalletForEntity(walletName)
  await savePairwiseData(wh, agentConnectionDid, userPairwiseDid, userPairwiseVerkey, 'user2agentconn')
  return { wh, walletName, walletKey, agentConnectionDid, agentConnectionVerkey }
}

module.exports = { createAgentConnectionWallet }
