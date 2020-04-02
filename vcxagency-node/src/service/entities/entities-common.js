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

const { indyListPairwise, indyKeyForLocalDid, indyCreatePairwise, indyStoreTheirDid } = require('easy-indysdk')

async function savePairwiseData (wh, ourDid, theirDid, theirVkey, name) {
  await indyStoreTheirDid(wh, theirDid, theirVkey)
  await indyCreatePairwise(wh, theirDid, ourDid, name)
}

async function loadPairwiseData (wh, name) {
  const pairwises = await indyListPairwise(wh)
  if (pairwises.length === 0) {
    return undefined
  }
  const owner2AgentPairwise = pairwises.find(r => r.metadata === name)
  if (!owner2AgentPairwise) {
    return undefined
  }
  const ourDid = owner2AgentPairwise.my_did
  const theirDid = owner2AgentPairwise.their_did
  const theirVkey = await indyKeyForLocalDid(wh, theirDid)
  return {
    ourDid, theirDid, theirVkey
  }
}

const entityType = {
  agent: 'agent',
  agentConnection: 'agent-connection',
  forwardAgent: 'forward-agent'
}

module.exports = {
  loadPairwiseData,
  savePairwiseData,
  entityType
}
