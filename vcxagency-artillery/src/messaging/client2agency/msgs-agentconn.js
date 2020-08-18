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

const MSGTYPE_GET_MSGS = 'did:sov:123456789abcdefghi1234;spec/pairwise/1.0/GET_MSGS'
const MSGTYPE_MSGS = 'did:sov:123456789abcdefghi1234;spec/pairwise/1.0/MSGS'

function buildMsgVcxV2GetMsgs (statusCodes = [], uids = []) {
  const msg = {
    '@type': MSGTYPE_GET_MSGS,
    statusCodes,
    uids
  }
  return msg
}

function buildMsgVcxV2Msgs (msgs) {
  const msg = {
    '@type': MSGTYPE_MSGS,
    msgs // array of messages; message structure: {payload, refMsgId, senderDID, statusCode, type, uid}
  }
  return msg
}

// get msgs: for particular agent-connection (recipient is agent-connection entity)
module.exports = {
  buildMsgVcxV2GetMsgs,
  buildMsgVcxV2Msgs,
  MSGTYPE_GET_MSGS,
  MSGTYPE_MSGS
}
