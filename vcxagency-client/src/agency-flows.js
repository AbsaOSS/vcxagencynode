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

const { buildAriesFwdMessage } = require('./messaging/aries/aries-msg')
const { buildAriesBasicMessage } = require('./messaging/aries/aries-msg')
const { buildAgencyFwdMessage } = require('./messaging/client2agency/general')
const { buildMsgVcxV2UpdateMsgStatusByConns } = require('./messaging/client2agency/msgs-agent')
const { buildMsgVcxV2MsgGetMsgsByConns } = require('./messaging/client2agency/msgs-agent')
const { buildMsgVcxV2GetMsgs } = require('./messaging/client2agency/msgs-agentconn')
const { buildMsgVcxV2CreateKey } = require('./messaging/client2agency/onboarding')
const { buildMsgVcxV2CreateAgent } = require('./messaging/client2agency/onboarding')
const { buildMsgVcxV2SignUp } = require('./messaging/client2agency/onboarding')
const { buildMsgVcxV2Connect } = require('./messaging/client2agency/onboarding')
const { packAsUtf8 } = require('easy-indysdk')
const { objectToBuffer } = require('./utils')
const { unpack } = require('easy-indysdk')
const { pack } = require('easy-indysdk')

async function parseAgencyResponse (userWh, bufferResponse) {
  const { message } = await unpack(userWh, bufferResponse)
  return JSON.parse(message)
}

function wrapWithAgencyFwd (recipient, bufferAsUtf8) {
  return objectToBuffer(buildAgencyFwdMessage(recipient, bufferAsUtf8))
}

/**
 First step of vcx onboarding
 */
async function vcxFlowConnect (clientWh, sendToAgency, recipientAgencyDid, recipientAgencyVkey, agencyUserDid, agencyUserVkey) {
  const msgConnect = await packAsUtf8(clientWh, objectToBuffer(buildMsgVcxV2Connect(agencyUserDid, agencyUserVkey)), recipientAgencyVkey, agencyUserVkey)
  const resEncrypted = await sendToAgency(wrapWithAgencyFwd(recipientAgencyDid, msgConnect))
  return parseAgencyResponse(clientWh, resEncrypted)
}

/**
 Second step of vcx onboarding
 */
async function vcxFlowSignUp (clientWh, sendToAgency, recipientTmpAgentDid, recipientTmpAgentVkey, agencyUserVkey) {
  const msgSignedUp = await packAsUtf8(clientWh, objectToBuffer(buildMsgVcxV2SignUp()), recipientTmpAgentVkey, agencyUserVkey)
  const resEncrypted = await sendToAgency(wrapWithAgencyFwd(recipientTmpAgentDid, msgSignedUp))
  return parseAgencyResponse(clientWh, resEncrypted)
}

/**
 Third step of vcx onboarding
 */
async function vcxFlowCreateAgent (clientWh, sendToAgency, recipientTmpAgentDid, recipientTmpAgentVkey, clientVkey) {
  const msgCreateAgent = await packAsUtf8(clientWh, objectToBuffer(buildMsgVcxV2CreateAgent()), recipientTmpAgentVkey, clientVkey)
  const resEncrypted = await sendToAgency(wrapWithAgencyFwd(recipientTmpAgentDid, msgCreateAgent))
  return parseAgencyResponse(clientWh, resEncrypted)
}

/**
 Create new Agent in Agency
 */
async function vcxFlowFullOnboarding (clientWh, sendToAgency, agencyDid, agencyVkey, agencyUserDid, agencyUserVkey) {
  const msgConnected = await vcxFlowConnect(clientWh, sendToAgency, agencyDid, agencyVkey, agencyUserDid, agencyUserVkey)
  const tmpAgentDid = msgConnected.withPairwiseDID
  const tmpAgentVerkey = msgConnected.withPairwiseDIDVerKey
  await vcxFlowSignUp(clientWh, sendToAgency, tmpAgentDid, tmpAgentVerkey, agencyUserVkey)
  const msgAgentCreated = await vcxFlowCreateAgent(clientWh, sendToAgency, tmpAgentDid, tmpAgentVerkey, agencyUserVkey)
  const agentDid = msgAgentCreated.withPairwiseDID
  const agentVerkey = msgAgentCreated.withPairwiseDIDVerKey
  return { agentDid, agentVerkey }
}

/**
 Creates agent-connection
 */
async function vcxFlowCreateAgentConnection (clientWh, sendToAgency, recipientAgentDid, recipientAgentVkey, clientVkey, userPairwiseDid, userPairwiseVkey) {
  const encryptionOurs = clientVkey
  const msgCreateAgentConn = await packAsUtf8(clientWh, objectToBuffer(buildMsgVcxV2CreateKey(userPairwiseDid, userPairwiseVkey)), recipientAgentVkey, encryptionOurs)
  const resEncrypted = await sendToAgency(wrapWithAgencyFwd(recipientAgentDid, msgCreateAgentConn))
  return parseAgencyResponse(clientWh, resEncrypted)
}

/**
 Downloads messages from particular agent-connection
 */
async function vcxFlowGetMsgsFromAgentConn (clientWh, sendToAgency, recipientAgentConnDid, recipientAgentConnVkey, userPairwiseVkey, statusCodes, uids) {
  const encryptionOurs = userPairwiseVkey
  const msgGetMsgs = await packAsUtf8(clientWh, objectToBuffer(buildMsgVcxV2GetMsgs(statusCodes, uids)), recipientAgentConnVkey, encryptionOurs)
  const resEncrypted = await sendToAgency(wrapWithAgencyFwd(recipientAgentConnDid, msgGetMsgs))
  return parseAgencyResponse(clientWh, resEncrypted)
}

/**
 Downloads messages from agent accross multiple agent connections
 * @param {string} clientWh - wallet handle of agency client
 * @param {object} sendToAgency - function which passes final message to an agency
 * @param {string} clientVkey - verkey the client uses to talk to Agency
 * @param {string} recipientAgentDid - DID of the Agent
 * @param {string} recipientAgentVerkey - Verkey of the Agent
 * @param {string} userPwDids - filter connection by these userPwDids
 * @param {array} uids - filter messages by these msg UIDs
 * @param {string} statusCodes - filter messages by status
 */
async function vcxFlowGetMsgsFromAgent (clientWh, sendToAgency, recipientAgentDid, recipientAgentVerkey, clientVkey, userPwDids, uids, statusCodes) {
  const encryptionOurs = clientVkey
  // todo: seems like the failus in agent decryption were because i am using here pack, instead of packAsUtf8, see above functions
  const msgGetMsgs = await packAsUtf8(clientWh, objectToBuffer(buildMsgVcxV2MsgGetMsgsByConns(userPwDids, uids, statusCodes)), recipientAgentVerkey, encryptionOurs)
  const resEncrypted = await sendToAgency(wrapWithAgencyFwd(recipientAgentDid, msgGetMsgs))
  return parseAgencyResponse(clientWh, resEncrypted)
}

/**
 Update statusCode of messages specified by UIDs per Agent-Connections
 * @param {string} clientWh - wallet handle of agency client
 * @param {object} sendToAgency - function which passes final message to an agency
 * @param {string} clientVkey - verkey the client uses to talk to Agency
 * @param {string} recipientAgentDid - DID of the Agent
 * @param {string} recipientAgentVkey - Verkey of the Agent
 * @param {array} uidsByConns - update
 * @param {string} statusCode - filter messages by status
 */
async function vcxFlowUpdateMsgsFromAgent (clientWh, sendToAgency, recipientAgentDid, recipientAgentVkey, clientVkey, uidsByConns, statusCode) {
  const encryptionOurs = clientVkey
  const msgUpdateMsgs = await packAsUtf8(clientWh, objectToBuffer(buildMsgVcxV2UpdateMsgStatusByConns(statusCode, uidsByConns)), recipientAgentVkey, encryptionOurs)
  const resEncrypted = await sendToAgency(wrapWithAgencyFwd(recipientAgentDid, msgUpdateMsgs))
  return parseAgencyResponse(clientWh, resEncrypted)
}

/**
 Send Aries message to someone's cloud agent
 */
async function vcxFlowSendAriesMessage (clientWh, sendToAgency, recipientVkey, recipientAgentConnRoutingVkey, e2eSenderVkey, msgString) {
  const msgAriesBasic = buildAriesBasicMessage('123', msgString, '2019-01-15 18:42:01Z')
  const msgPackedForRecipient = await pack(clientWh, objectToBuffer(msgAriesBasic), recipientVkey, e2eSenderVkey)
  const msgAriesFwdToRecipient = buildAriesFwdMessage(recipientVkey, JSON.parse(msgPackedForRecipient.toString('utf8')))
  const msgAnonPackedForAgentConn = await packAsUtf8(clientWh, objectToBuffer(msgAriesFwdToRecipient), recipientAgentConnRoutingVkey)
  const bufferRes = await sendToAgency(wrapWithAgencyFwd(recipientAgentConnRoutingVkey, msgAnonPackedForAgentConn))
  return bufferRes.toString()
}

module.exports = {
  // onboarding
  vcxFlowConnect,
  vcxFlowSignUp,
  vcxFlowCreateAgent,
  vcxFlowFullOnboarding,

  // creating agent connection
  vcxFlowCreateAgentConnection,

  // sending aries msg to someone's cloud agent
  vcxFlowSendAriesMessage,

  // msgs per agent connection
  vcxFlowGetMsgsFromAgentConn,

  // msgs across agent
  vcxFlowGetMsgsFromAgent,
  vcxFlowUpdateMsgsFromAgent
}
