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

const MSGTYPE_GET_MSGS_BY_CONNS = 'did:sov:123456789abcdefghi1234;spec/pairwise/1.0/GET_MSGS_BY_CONNS'
const MSGTYPE_MSGS_BY_CONNS = 'did:sov:123456789abcdefghi1234;spec/pairwise/1.0/MSGS_BY_CONNS'
const MSGTYPE_UPDATE_MSG_STATUS_BY_CONNS = 'did:sov:123456789abcdefghi1234;spec/pairwise/1.0/UPDATE_MSG_STATUS_BY_CONNS'
const MSGTYPE_MSG_STATUS_UPDATED_BY_CONNS = 'did:sov:123456789abcdefghi1234;spec/pairwise/1.0/MSG_STATUS_UPDATED_BY_CONNS'
const MSGTYPE_UPDATE_COM_METHOD = 'did:sov:123456789abcdefghi1234;spec/configs/1.0/UPDATE_COM_METHOD'
const MSGTYPE_COM_METHOD_UPDATED = 'did:sov:123456789abcdefghi1234;spec/configs/1.0/COM_METHOD_UPDATED'
const MSGTYPE_UPDATE_CONFIGS = 'did:sov:123456789abcdefghi1234;spec/configs/1.0/UPDATE_CONFIGS'
const MSGTYPE_CONFIGS_UPDATED = 'did:sov:123456789abcdefghi1234;spec/configs/1.0/CONFIGS_UPDATED'

function buildMsgVcxV2MsgGetMsgsByConns (pairwiseDIDs, uids, statusCodes) {
  const msg = {
    '@type': MSGTYPE_GET_MSGS_BY_CONNS,
    uids, // should be array like ["b7vh36XiTe"]
    pairwiseDIDs, // array like ["Fp4eVWcjyRawjNWgnJmJWD"]}
    statusCodes // ["MS-102","MS-103","MS-104","MS-105","MS-106"]
  }
  return msg
}

function buildVcxV2AgencyMsg (payload, senderDID, statusCode, uid) {
  return {
    payload,
    refMsgId: null,
    senderDID: '',
    statusCode,
    type: 'aries',
    uid
  }
}

function buildVcxV2AgencyMsgsByConn (agencyMsgs, pairwiseDid) {
  return {
    pairwiseDID: pairwiseDid,
    msgs: agencyMsgs
  }
}

function buildMsgVcxV2MsgsByConns (msgsByConns) {
  const msg = {
    '@type': MSGTYPE_MSGS_BY_CONNS,
    msgsByConns
  }
  return msg
}

function buildVcxV2UidsByConn (pairwiseDid, uids) {
  return {
    pairwiseDID: pairwiseDid,
    uids // ["b7vh36XiTe", "aBcDeF1234"]
  }
}

function buildMsgVcxV2UpdateMsgStatusByConns (statusCode, uidsByConns) {
  const msg = {
    '@type': MSGTYPE_UPDATE_MSG_STATUS_BY_CONNS,
    statusCode,
    uidsByConns // example: [{"pairwiseDID":"6FRuB95abcmzz1nURoHyWE","uids":["Br4CoNP4TU"]}, ...]
  }
  return msg
}

function buildMsgVcxV2MsgStatusUpdatedByConns (failedUidsByConns, updatedUidsByConns) {
  const msg = {
    '@type': MSGTYPE_MSG_STATUS_UPDATED_BY_CONNS,
    failed: failedUidsByConns, // [{"pairwiseDID":"Fp4eVWcjyRawjNWgnJmJWD","uids":["aBcDeF1234"]}]}
    updatedUidsByConns // example: [{"pairwiseDID":"Fp4eVWcjyRawjNWgnJmJWD","uids":["b7vh36XiTe"]}]}
  }
  return msg
}

function buildMsgVcxV2UpdateWebhookUrl (webhookUrl) {
  const msg = {
    '@type': MSGTYPE_UPDATE_COM_METHOD,
    comMethod: {
      id: '123', // it's not clear how to use this parameter in libvcx, dummy cloud agency is not utilizing it either
      type: '2', // '2' signals webhook com method
      value: webhookUrl
    }
  }
  return msg
}

function buildMsgCommMethodUpdated (id) {
  const msg = {
    '@type': MSGTYPE_COM_METHOD_UPDATED,
    id: id
  }
  return msg
}

function buildMsgConfigsUpdated () {
  const msg = {
    '@type': MSGTYPE_CONFIGS_UPDATED
  }
  return msg
}

module.exports = {
  // get msgs: for many agent-connections (recipient is agent entity)
  buildMsgVcxV2MsgGetMsgsByConns, // req
  buildVcxV2AgencyMsg,
  buildVcxV2AgencyMsgsByConn,
  buildMsgVcxV2MsgsByConns, // res

  // update by connections (message for agent)
  buildMsgVcxV2UpdateMsgStatusByConns, // req
  buildMsgVcxV2MsgStatusUpdatedByConns, // res
  buildVcxV2UidsByConn,

  buildMsgVcxV2UpdateWebhookUrl,
  buildMsgCommMethodUpdated,
  buildMsgConfigsUpdated,

  MSGTYPE_GET_MSGS_BY_CONNS,
  MSGTYPE_MSGS_BY_CONNS,

  MSGTYPE_UPDATE_MSG_STATUS_BY_CONNS,
  MSGTYPE_MSG_STATUS_UPDATED_BY_CONNS,

  MSGTYPE_UPDATE_COM_METHOD,
  MSGTYPE_COM_METHOD_UPDATED,

  MSGTYPE_UPDATE_CONFIGS,
  MSGTYPE_CONFIGS_UPDATED
}
