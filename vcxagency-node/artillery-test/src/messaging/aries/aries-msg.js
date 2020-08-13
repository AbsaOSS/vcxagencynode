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

const MSGTYPE_ARIES_FWD = 'did:sov:BzCbsNYhMrjHiqZDTUASHg;spec/routing/1.0/forward'
const MSGTYPE_ARIES_BASIC_MSG = 'did:sov:BzCbsNYhMrjHiqZDTUASHg;spec/basicmessage/1.0/message'

function buildAriesFwdMessage (to, msgObject) {
  const msg = {
    '@type': MSGTYPE_ARIES_FWD,
    to: to,
    msg: msgObject
  }
  return msg
}

function buildAriesBasicMessage (id, msgString, sentUtime = '2019-01-15 18:42:01Z') {
  const msg = {
    '@id': '123456780',
    '@type': MSGTYPE_ARIES_BASIC_MSG,
    '~l10n': { locale: 'en' },
    sent_time: sentUtime,
    content: msgString
  }
  return msg
}

module.exports = {
  buildAriesFwdMessage,
  buildAriesBasicMessage,
  MSGTYPE_ARIES_FWD,
  MSGTYPE_ARIES_BASIC_MSG
}
