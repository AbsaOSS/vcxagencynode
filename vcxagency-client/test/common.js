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

const { anonCrypt, indyOpenWallet, indyCreateWallet, indyCreateAndStoreMyDid } = require('easy-indysdk')
const { vcxFlowFullOnboarding, vcxFlowCreateAgentConnection } = require('vcxagency-client/src')
const uuid = require('uuid')
const axios = require('axios')
const util = require('util')
const path = require('path')
const dotenv = require('dotenv')

module.exports.loadEnvVariables = function loadEnvVariables () {
  const env = process.env.ENVIRONMENT || 'localhost'
  const pathToConfig = path.resolve(__dirname, `./config/${env}.env`)
  dotenv.config({ path: pathToConfig })
}

/**
 * Builds function which deliver a message to Forward Agent of Agency. This is useful when you want to
 * deliver messages to VCX Agency without having to hook it up to network. You can use this function to simulate
 * sending messages to the agency without having to deal with networking.
 *
 * @param {string} agencyUrl - URL of Agency
 */
module.exports.buildAgencyClientNetwork = async function buildAgencyClientNetwork (agencyUrl) {
  const anoncryptWh = await createAnoncryptWallet()

  const { verkey: agencyVerkey } = await getAgencyInfo()

  async function getAgencyInfo () {
    const { data: { DID, verKey } } = await axios.get(`${agencyUrl}/agency`)
    return { did: DID, verkey: verKey }
  }

  async function sendToAgency (msgBuffer) {
    const msgForAgencyBuffer = await anonCrypt(anoncryptWh, msgBuffer, agencyVerkey)
    const headers = { 'Content-Type': 'application/ssi-agent-wire' }
    let res
    try {
      res = await axios.post(`${agencyUrl}/agency/msg`, msgForAgencyBuffer.toString('utf8'), { headers })
    } catch (err) {
      throw Error(`Error response from agency! ${util.inspect(err)}`)
    }
    const { data } = res
    if (data.errorMsg) {
      throw Error(res.errorMsg)
    }
    return Buffer.from(JSON.stringify(data), 'utf8')
  }

  async function isHealthy () {
    const { data } = await axios(`${agencyUrl}/api/health`)
    return data
  }

  return {
    sendToAgency,
    getAgencyInfo,
    isHealthy
  }
}

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

module.exports.createConnectedAliceAndBob = async function createConnectedAliceAndBob ({ aliceWh, sendToAgency, agencyDid, agencyVerkey, aliceDid, aliceVerkey, bobWh, bobDid, bobVerkey }) {
  const { agentDid: aliceAgentDid, agentVerkey: aliceAgentVerkey } = await vcxFlowFullOnboarding(aliceWh, sendToAgency, agencyDid, agencyVerkey, aliceDid, aliceVerkey)
  const { did: aliceUserPairwiseDid, vkey: aliceUserPairwiseVerkey } = await indyCreateAndStoreMyDid(aliceWh)
  console.log('Alice was onboarded.')

  const { agentDid: bobAgentDid, agentVerkey: bobAgentVerkey } = await vcxFlowFullOnboarding(bobWh, sendToAgency, agencyDid, agencyVerkey, bobDid, bobVerkey)
  const { did: bobUserPairwiseDid, vkey: bobUserPairwiseVerkey } = await indyCreateAndStoreMyDid(bobWh)
  console.log('Bob was onboarded.')

  // create agent connection, both alice and bob
  console.log(`Alice is going to create agent connection. aliceAgentDid=${aliceAgentDid} aliceVerkey=${aliceVerkey} aliceUserPairwiseDid=${aliceUserPairwiseDid} aliceUserPairwiseVerkey=${aliceUserPairwiseVerkey}`)
  const alicesAconn = await vcxFlowCreateAgentConnection(aliceWh, sendToAgency, aliceAgentDid, aliceAgentVerkey, aliceVerkey, aliceUserPairwiseDid, aliceUserPairwiseVerkey)
  const alicesRoutingAgentDid = alicesAconn.withPairwiseDID
  const alicesRoutingAgentVerkey = alicesAconn.withPairwiseDIDVerKey
  console.log('Alice created agent connection!')
  const bobsAconn = await vcxFlowCreateAgentConnection(bobWh, sendToAgency, bobAgentDid, bobAgentVerkey, bobVerkey, bobUserPairwiseDid, bobUserPairwiseVerkey)
  const bobsRoutingAgentDid = bobsAconn.withPairwiseDID
  const bobsRoutingAgentVerkey = bobsAconn.withPairwiseDIDVerKey

  return { aliceAgentDid, aliceAgentVerkey, aliceUserPairwiseDid, aliceUserPairwiseVerkey, bobAgentDid, bobAgentVerkey, bobUserPairwiseDid, bobUserPairwiseVerkey, alicesRoutingAgentDid, alicesRoutingAgentVerkey, bobsRoutingAgentDid, bobsRoutingAgentVerkey }
}
