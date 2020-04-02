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
 * Convert persisted message format to LibVCX client message format
 */
function storedMessageToResponseFormat (storedMsg) {
  const { payload } = storedMsg
  const { metadata: { uid, statusCode } } = storedMsg
  return { senderDID: '', payload, uid, statusCode, type: 'aries' }
}

/**
 * Builds up message in format as it is persisted.
 */
function buildStoredMessage (agentDid, agentConnectionDid, uid, statusCode, dataObject) {
  return {
    metadata: {
      agentDid,
      agentConnectionDid,
      uid,
      statusCode
    },
    payload: dataObject
  }
}

module.exports = {
  storedMessageToResponseFormat,
  buildStoredMessage
}
