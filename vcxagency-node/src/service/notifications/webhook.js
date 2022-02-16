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

const axios = require('axios')
const uuid = require('uuid')
const httpContext = require('express-http-context')
const logger = require('../../logging/logger-builder')(__filename)

async function sendNotification (webhookUrl, msgUid, msgStatusCode, notificationId, pwDid) {
  const notification = {
    msgUid, msgType: 'aries', theirPwDid: '', msgStatusCode, notificationId, pwDid
  }
  const headers = {}
  const xRequestId = httpContext.get('reqId')
  if (xRequestId) {
    headers['X-Request-ID'] = xRequestId
  } else {
    const xRequestId = uuid.v4()
    headers['X-Request-ID'] = xRequestId
    logger.error(`Sending webhook notification but reqId was not found in httpContext. Setting X-Request-ID to '${xRequestId}'.`)
  }
  await axios.post(webhookUrl, notification, { headers })
}

module.exports = { sendNotification }
