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
  MSGTYPE_SIGNUP,
  MSGTYPE_CREATE_AGENT,
  MSGTYPE_CREATE_KEY,
  MSGTYPE_GET_MSGS_BY_CONNS,
  MSGTYPE_UPDATE_MSG_STATUS_BY_CONNS,
  MSGTYPE_UPDATE_COM_METHOD,
  MSGTYPE_UPDATE_CONFIGS,
  buildMsgCommMethodUpdated,
  buildMsgConfigsUpdated,
  buildMsgVcxV2MsgStatusUpdatedByConns,
  buildVcxV2AgencyMsgsByConn,
  buildMsgVcxV2MsgsByConns,
  buildMsgVcxV2KeyCreated,
  buildMsgVcxV2AgentCreated,
  buildMsgVcxV2SignedUp,
  parseAuthcrypted
} = require('vcxagency-client')
const { pack } = require('easy-indysdk')
const { storedMessageToResponseFormat } = require('../../storage/store-util')
const { createAgentConnectionData } = require('../agent-connection/agent-connection')
const { createAgentWallet } = require('./agent-internal')
const logger = require('../../../logging/logger-builder')(__filename)
const { objectToBuffer } = require('../../util')
const { entityType } = require('../entities-common')

const AGENT_WALLET_KDF = 'RAW'

/**
 * Creates persistent identity records (entity record, wallet) of Agent entity. Agent is owned by holder of a verkey.
 * @param {string} ownerDid - DID of Agent owner
 * @param {string} ownerVerkey - Verkey of Agent owner
 * @param {object} serviceWallets - Service for indy wallet management interface
 * @param {object} serviceStorage - Entity record persistent storage interface
 */
async function createAgentData (ownerDid, ownerVerkey, serviceWallets, serviceStorage) {
  logger.info(`Creating agent: ownerDid=${ownerDid}, ownerVerkey=${ownerVerkey}`)
  const { walletName, walletKey, agentDid, agentVerkey } = await createAgentWallet(serviceWallets, ownerDid)
  const entityRecord = {
    walletName,
    walletKey,
    entityType: entityType.agent,
    entityVersion: '1',
    ownerDid,
    ownerVerkey,
    agentDid,
    agentVerkey
  }
  await serviceStorage.saveEntityRecord(agentDid, agentVerkey, entityRecord)
  return { agentDid, agentVerkey }
}

/**
 * Build Agent Access Object, an object capable of writing and reading data associated with the Agent
 * @param {object} entityRecord - An "Agent Entity Record" containing data necessary to build AgentAO.
 * @param {object} serviceWallets - Service for indy wallet management interface
 * @param {object} serviceStorage - Service for accessing entity storage
 */
async function buildAgentAO (entityRecord, serviceWallets, serviceStorage, router) {
  const { walletName, walletKey } = entityRecord
  const { ownerVerkey, agentDid, agentVerkey } = await loadInfo()
  const wh = await serviceWallets.getWalletHandle(walletName, walletKey, AGENT_WALLET_KDF)

  /**
   * @return {object} Basic information about the Agent
   */
  function loadInfo () {
    const { ownerDid, ownerVerkey } = entityRecord
    const { agentDid, agentVerkey } = entityRecord
    return {
      ownerDid,
      ownerVerkey,
      agentDid,
      agentVerkey
    }
  }

  const whoami = `[Agent ${agentDid}]`

  async function isAuthorized (senderVerkey) {
    return senderVerkey === ownerVerkey
  }

  /**
   * Try to handle message addressed for this Agent. If message can't be decrypted using Agent's keys, the message
   * is of invalid type, the sender of the message is not owner of the agent, Error will be thrown.
   * All messages incoming to Agent are authorized against owner verkey, regardless of message type. Only owner can
   * talk to the Agent entity.
   * @param {buffer} msgBuffer - Message data
   */
  async function handleRoutedMessage (msgBuffer) {
    const { message: msgObject, senderVerkey } = await parseAuthcrypted(wh, msgBuffer)
    const { response, wasEncrypted } = await _handleDecryptedMsg(msgObject, senderVerkey)
    if (!wasEncrypted) {
      return pack(wh, objectToBuffer(response), senderVerkey, agentVerkey)
    } else {
      return response
    }
  }

  async function _handleDecryptedMsg (msgObject, senderVerkey) {
    if ((await isAuthorized(senderVerkey)) === false) {
      throw Error(`${whoami} Sender ${senderVerkey} is not authorized, it is not owner of this agent.`)
    }
    const msgType = msgObject['@type']
    if (msgType === MSG_TYPE_AGENCY_FWD) {
      logger.info(`${whoami} Handling message type ${msgType}`)
      const responseBuffer = await _handleAuthorizedFwdMessage(msgObject)
      return { response: responseBuffer, wasEncrypted: true }
    } else {
      logger.info(`${whoami} Handling message ${JSON.stringify(msgObject)}`)
      const responseObject = await _handleAuthorizedAgentMessage(msgObject, senderVerkey)
      logger.debug(`${whoami} Sending response: ${JSON.stringify(responseObject)}`)
      return { response: responseObject, wasEncrypted: false }
    }
  }

  async function _handleAuthorizedAgentMessage (msgObject) {
    const msgType = msgObject['@type']
    if (msgType === MSGTYPE_SIGNUP) {
      return _handleSignUpMsg(msgObject)
    } else if (msgType === MSGTYPE_CREATE_AGENT) {
      return _handleCreateAgent(msgObject)
    } else if (msgType === MSGTYPE_CREATE_KEY) {
      return _handleCreateKey(msgObject)
    } else if (msgType === MSGTYPE_UPDATE_COM_METHOD) {
      return _handleUpdateComMethod(msgObject)
    } else if (msgType === MSGTYPE_UPDATE_CONFIGS) {
      return _handleUpdateConfigs(msgObject)
    } else if (msgType === MSGTYPE_GET_MSGS_BY_CONNS) {
      return _handleGetMsgsByConn(msgObject)
    } else if (msgType === MSGTYPE_UPDATE_MSG_STATUS_BY_CONNS) {
      return _handleUpdateMsgsStatusByConns(msgObject)
    } else {
      throw Error(`${whoami} Message of type '${msgType}' is not recognized VCX Agent message type.`)
    }
  }

  async function _handleAuthorizedFwdMessage (msgObject) {
    const fwd = msgObject['@fwd']
    const msg = msgObject['@msg']
    if (!fwd) {
      throw Error(`${whoami} VCX V2 Forward message expected to have field '@fwd'. Message: ${JSON.stringify(msgObject)}'`)
    }
    if (!msg) {
      throw Error(`${whoami} VCX V2 Forward message expected to have field '@msg'. Message: ${JSON.stringify(msgObject)}'`)
    }
    return router.routeMsg(fwd, Buffer.from(JSON.stringify(msg)))
  }

  async function _handleUpdateComMethod (msgObject) {
    const { comMethod: { value, type, id } } = msgObject
    if (type === '2') {
      await setWebhook(value)
      return buildMsgCommMethodUpdated(id) // TODO: What's meaning of 'id' field? This reflects dummy-cloud-agency impl.
    } else {
      throw Error(`${whoami} Unsupported com method type ${type}`)
    }
  }

  async function _handleUpdateConfigs (msgObject) {
    const { configs } = msgObject
    try {
      await updateConfigs(configs)
      return buildMsgConfigsUpdated()
    } catch (err) {
      throw Error(`${whoami} Failed to update configs: ${err}`)
    }
  }

  async function _handleGetMsgsByConn (msgObject) {
    const { uids, pairwiseDIDs, statusCodes } = msgObject
    const didPairs = await serviceStorage.aconnLinkPairsByPwDids(agentDid, pairwiseDIDs)
    const msgsByConns = []
    for (const didPair of didPairs) {
      const { agentConnDid, userPwDid } = didPair
      logger.info(`${whoami} Getting messages for pair ${JSON.stringify(didPair)}`)
      const storedMsgs = await serviceStorage.loadMessages(agentDid, [agentConnDid], uids, statusCodes)
      logger.info(`${whoami} Found ${storedMsgs.length} messages`)
      const responseMsgs = storedMsgs.map(storedMessageToResponseFormat)
      msgsByConns.push(buildVcxV2AgencyMsgsByConn(responseMsgs, userPwDid))
    }
    return buildMsgVcxV2MsgsByConns(msgsByConns)
  }

  async function convertToUidsByPwDids (uidsByAconnDids, ignoreNotFound = false) {
    const uidsByPwDids = []
    for (const rec of uidsByAconnDids) {
      const { agentConnDid, uids } = rec
      const userPwDid = await serviceStorage.aconnDidToPwDid(agentDid, agentConnDid)
      if (userPwDid) {
        uidsByPwDids.push({ pairwiseDID: userPwDid, uids })
      } else if (!ignoreNotFound) {
        throw Error(`AgentConnectionDid ${agentConnDid} could not be mapped to any userPwDid.`)
      }
    }
    return uidsByPwDids
  }

  /**
   * Takes list of "uids by pw dids", example: [{"pairwiseDID":"Fp4eVWcjyRawjNWgnJmJWD","uids":["b7vh36XiTe"]}]}
   * and converts it to "uids by agent connection dids": [{"agentConnDid":"abcd1234565","uids":["b7vh36XiTe"]}]}
   * So that each userPairwiseDid is converted to agentConnectionDid
   * @param {array} uidsByPwDids - Message data
   * @param {boolean} ignoreNotFound - Message data
   */
  async function convertToUidsByAgentConnDids (uidsByPwDids, ignoreNotFound = false) {
    const uidsByAconnDids = []
    for (const rec of uidsByPwDids) {
      const { pairwiseDID, uids } = rec
      const agentConnDid = await serviceStorage.pwDidToAconnDid(agentDid, pairwiseDID)
      if (agentConnDid) {
        uidsByAconnDids.push({ agentConnDid, uids })
      } else if (!ignoreNotFound) {
        throw Error(`UserPwDid ${pairwiseDID} could not be mapped to agenConnectionDid.`)
      }
    }
    return uidsByAconnDids
  }

  // "failed":[],"updatedUidsByConns":[{"pairwiseDID":"Fp4eVWcjyRawjNWgnJmJWD","uids":["b7vh36XiTe"]}]}
  async function _handleUpdateMsgsStatusByConns (msgObject) {
    const { statusCode, uidsByConns } = msgObject
    const uidsByAgentConnDids = await convertToUidsByAgentConnDids(uidsByConns, true)
    const { failed, updated } = await serviceStorage.updateStatusCodes(agentDid, uidsByAgentConnDids, statusCode)
    const updatedUidsByConns = await convertToUidsByPwDids(updated)
    const failedUidsByConns = await convertToUidsByPwDids(failed)
    return buildMsgVcxV2MsgStatusUpdatedByConns(failedUidsByConns, updatedUidsByConns)
  }

  async function _handleSignUpMsg (_msgObject) {
    // noop.

    // In rust dummy cloud agency this sort of middle step where a flag that client has signed up
    // I am not sure what was purpose of that step
    return buildMsgVcxV2SignedUp()
  }

  async function _handleCreateAgent (_msgObject) {
    const { agentDid, agentVerkey } = loadInfo()
    // noop.

    // I dummy cloud agency this is step where "Agent" is created from "Agent Connection" and
    // Agent creates new wallet with new did, returning that back to client. Then the vcx client start to talk
    // to the Agent, addressing his DID and hi verkey.
    // I don't see reason to create new wallet, so the behaviour could be simulated by performing key rotation,
    // but I don't see what's (presumably) security benefit of doing so at this stage.

    // await indy.replaceKeysStart(wh, agentDid, {})
    // await indy.replaceKeysApply(wh, agentDid)
    // const newAgentVerkey = await indy.keyForLocalDid(wh, agentDid)
    return buildMsgVcxV2AgentCreated(agentDid, agentVerkey)
  }

  async function _handleCreateKey (msgObject) {
    const { ownerDid, ownerVerkey } = loadInfo()
    const { forDID: userPairwiseDid, forDIDVerKey: userPairwiseVerkey } = msgObject
    const { agentConnectionDid, agentConnectionVerkey } = await createAgentConnectionData(agentDid, ownerDid, ownerVerkey, userPairwiseDid, userPairwiseVerkey, serviceWallets, serviceStorage)
    return buildMsgVcxV2KeyCreated(agentConnectionDid, agentConnectionVerkey)
  }

  function _isHttpOrHttps (url) {
    return url.substring(0, 7) === 'http://' || url.substring(0, 8) === 'https://'
  }

  async function _unsetWebhook () {
    logger.info(`${whoami} Unsetting webhook url`)
    await serviceStorage.setAgentWebhook(agentDid, null)
  }

  async function setWebhook (webhookUrl) {
    logger.info(`${whoami} Set webhook, new value=${webhookUrl}`)
    if (!webhookUrl) {
      return await _unsetWebhook()
    }
    if (typeof webhookUrl !== 'string') {
      throw Error('Webhook url must be string!')
    }
    if (!_isHttpOrHttps(webhookUrl)) {
      throw Error(`Webhook url '${webhookUrl}' must be specify http or https protocol.`)
    }
    await serviceStorage.setAgentWebhook(agentDid, webhookUrl)
  }

  async function getWebhook () {
    return serviceStorage.getAgentWebhook(agentDid)
  }

  async function updateConfigs (configs) {
    const allowedNames = new Set(['name', 'logoUrl', 'publicDid'])
    if (!Array.isArray(configs)) throw Error('Configs to update must be an array!')
    configs.forEach(config => {
      if (!allowedNames.has(config.name)) throw Error(`Config name ${config.name} not allowed!`)
      // TODO: Implement updating
    })
  }

  return {
    loadInfo,
    handleRoutedMessage,
    setWebhook,
    getWebhook
  }
}

module.exports = {
  buildAgentAO,
  createAgentData
}
