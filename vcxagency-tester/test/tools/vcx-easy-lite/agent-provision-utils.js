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

"use strict"

const { provisionAgent } = require('node-vcx-wrapper')
const axios = require('axios')

async function fetchAgencyDidVkey (agencyInfoEndpoint) {
  const { data: { DID: agencyDid, verKey: agencyVerkey } } = await axios.get(agencyInfoEndpoint)
  if (!agencyDid || !agencyVerkey) {
    throw Error(`Couldn't parse agency did or verkey from url: ${agencyInfoEndpoint}`)
  }
  return { agencyDid, agencyVerkey }
}

async function createAgentProvision (
  walletName,
  seed,
  agencyEndpoint,
  genesisPath,
  institutionName,
  logoUrl,
  agencyDid,
  agencyVerkey,
  walletKeyDerivation,
  walletKey) {
  const config = {
    name: walletName,
    logo: logoUrl,
    path: genesisPath,
    agency_url: agencyEndpoint,
    agency_did: agencyDid,
    agency_verkey: agencyVerkey,
    wallet_name: walletName,
    wallet_key: walletKey,
    wallet_key_derivation: walletKeyDerivation,
    payment_method: 'null',
    enterprise_seed: seed,
    protocol_type: '2.0',
    communication_method: 'aries'
  }
  return JSON.parse(await provisionAgent(JSON.stringify(config)))
}

module.exports.fetchAgencyDidVkey = fetchAgencyDidVkey
module.exports.createAgentProvision = createAgentProvision
