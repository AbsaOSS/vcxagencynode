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

const {
  MSG_TYPE_AGENCY_FWD,
  MSGTYPE_ARIES_FWD,
  parseAuthcrypted,
  parseAnoncrypted,
  buildMsgVcxV2Connected

} = require('vcxagency-client')
const { pack, indyCreateAndStoreMyDid, indyDidExists, indyKeyForLocalDid } = require('easy-indysdk')
const logger = require('../../../logging/logger-builder')(__filename)
const util = require('util')
const { objectToBuffer } = require('../../util')
const uuid = require('uuid')
const { createAgentData } = require('../agent/agent')

const FWA_KDF = 'ARGON2I_MOD'

async function assureFwaWalletWasSetUp (serviceIndyWallets, agencyWalletName, agencyWalletKey, agencyDid, agencySeed) {
  logger.info(`FWA Assuring its wallet '${agencyWalletName}' exists`)
  await serviceIndyWallets.assureWallet(agencyWalletName, agencyWalletKey, FWA_KDF)

  logger.info(`Getting '${agencyWalletName}' wallet handle.`)
  const wh = await serviceIndyWallets.getWalletHandle(agencyWalletName, agencyWalletKey, FWA_KDF)
  const agencyDidWasSetUp = await indyDidExists(wh, agencyDid)
  if (!agencyDidWasSetUp) {
    logger.info(`Agency DID '${agencyWalletName}' not found in wallet. Creating.`)
    await indyCreateAndStoreMyDid(wh, agencyDid, agencySeed)
    logger.debug(`Forward agent create ${agencyDid}`)
  }
  const agencyVerkey = await indyKeyForLocalDid(wh, agencyDid)
  logger.info(`Agency DID '${agencyWalletName}' has assigned verkey ${agencyVerkey}`)
  return agencyVerkey
}

/**
 * Builds Agency Forward Agent. This is a special type of entity which:
 * - anon-decrypts every incoming request and passes it to router
 * - handles initial 1st (of 3) step of agent onboarding
 *
 * There should be only 1 instance of Forward Agent. Forward Agent has circular dependency with Router and Resolver.
 * This is design trade off to have simple singleton.
 */
async function buildForwardAgent (serviceIndyWallets, serviceStorage, agencyWalletName, agencyWalletKey, agencyDid, agencySeed) {
  const agencyVerkey = await assureFwaWalletWasSetUp(serviceIndyWallets, agencyWalletName, agencyWalletKey, agencyDid, agencySeed)
  let router, resolver

  const whoami = `[ForwardAgent ${agencyDid}]`

  async function setResolver (resolverObject) {
    resolver = resolverObject
  }

  async function setRouter (routerObject) {
    router = routerObject
  }

  async function processMsgAriesFwd (messageObj) {
    logger.debug(`entity-fwa::processAriesFwdMessage >> messageObj = ${JSON.stringify(messageObj)}`)
    const { to, msg } = messageObj
    if (!to) {
      throw Error(`'Aries FWD message expected to have field 'to'. Message: ${JSON.stringify(messageObj)}'`)
    }
    if (!msg) {
      throw Error(`'Aries FWD message expected to have field 'msg'. Message: ${JSON.stringify(messageObj)}'`)
    }
    return router.routeMsg(to, Buffer.from(JSON.stringify(msg)))
  }

  async function processMsgVcxV2Fwd (messageObj) {
    const fwd = messageObj['@fwd']
    const msg = messageObj['@msg']
    if (!fwd) {
      throw Error(`'VCX V2 Forward message expected to have field '@fwd'. Message: ${JSON.stringify(messageObj)}'`)
    }
    if (!msg) {
      throw Error(`'VCX V2 Forward message expected to have field '@msg'. Message: ${JSON.stringify(messageObj)}'`)
    }
    return router.routeMsg(fwd, Buffer.from(JSON.stringify(msg)))
  }

  async function handleMsgVcxV2Connect (messageObj, senderVerkey) {
    logger.debug(`entity-fwa::handleMsgVcxV2Connect >> messageObj = ${JSON.stringify(messageObj)}, senderVerkey = ${senderVerkey}`)
    const { fromDID, fromDIDVerKey } = messageObj
    if (!fromDID) {
      throw Error(`VCX A2AMessageV2::Connect expected to have field 'fromDID'.`)
    }
    if (!fromDIDVerKey) {
      throw Error(`VCX A2AMessageV2::Connect expected to have field 'fromDIDVerKey'.`)
    }
    if (fromDIDVerKey !== senderVerkey) {
      throw Error(`VCX A2AMessageV2::Connect message declares verkey ${fromDIDVerKey} but sender used verkey ${senderVerkey}. These must match.`)
    }
    // todo: here we would integrate KYC based authorization - the user vkey will have to authorized in prior to establishing connection
    const { agentDid } = await createAgentData(fromDID, fromDIDVerKey, serviceIndyWallets, serviceStorage)
    const agent = await resolver.resolveEntityAO(agentDid)
    const agentInfo = await agent.loadInfo()
    logger.info(`Created new Agent entity: ${JSON.stringify(agentInfo, null, 2)}`)
    const { agentVerkey } = agentInfo
    return buildMsgVcxV2Connected(agentDid, agentVerkey)
  }

  async function handleIncomingMessage (msgBuffer) {
    try {
      logger.info(`${whoami} Agency received message.`)
      logger.silly(`${whoami} Agency received message. Buffer Utf8: ${msgBuffer.toString('utf8')}`)
      const wh = await serviceIndyWallets.getWalletHandle(agencyWalletName, agencyWalletKey, FWA_KDF)
      const message = await parseAnoncrypted(wh, msgBuffer)
      const msgType = message['@type']
      if (msgType === MSG_TYPE_AGENCY_FWD) {
        logger.info(`${whoami} Received AgencyFWD message`)
        return await processMsgVcxV2Fwd(message)
      } else if (msgType === MSGTYPE_ARIES_FWD) {
        logger.info(`${whoami} Received AriesFWD message`)
        return await processMsgAriesFwd(message)
      } else {
        throw Error(`${whoami} Can't handle message of type ${msgType}`)
      }
    } catch (err) {
      const errorTraceId = uuid.v4()
      logger.error(`${whoami} Error thrown while processing received message. ErrorTraceId ${errorTraceId} Error: ${util.inspect(err)}`)
      return { errorMsg: err.message, errorTraceId }
    }
  }

  async function handleRoutedMessage (msgBuffer) {
    const wh = await serviceIndyWallets.getWalletHandle(agencyWalletName, agencyWalletKey, FWA_KDF)
    try {
      const { message: msgObject, senderVerkey } = await parseAuthcrypted(wh, msgBuffer)
      const resObject = await _handleDecryptedMsg(msgObject, senderVerkey)
      return pack(wh, objectToBuffer(resObject), senderVerkey, agencyVerkey)
    } catch (err) {
      logger.error(util.inspect(err))
      throw Error(`Failed to handle routed message`)
    }
  }

  async function _handleDecryptedMsg (msgObject, senderVerkey) {
    logger.info(`${whoami} Handling message ${JSON.stringify(msgObject)} from sender ${senderVerkey}`)
    const resObject = await handleMsgVcxV2Connect(msgObject, senderVerkey)
    logger.debug(`${whoami} Sending response: ${JSON.stringify(resObject)}`)
    return resObject
  }

  function getForwadAgentInfo () {
    return {
      did: agencyDid,
      verkey: agencyVerkey
    }
  }

  return {
    setResolver,
    setRouter,
    getForwadAgentInfo,
    handleIncomingMessage,
    handleRoutedMessage
  }
}

module.exports = { buildForwardAgent }
