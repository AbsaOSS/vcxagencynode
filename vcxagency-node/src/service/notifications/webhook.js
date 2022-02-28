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

const http = require('http')
const https = require('https')
const axios = require('axios')
const uuid = require('uuid')
const httpContext = require('express-http-context')
const logger = require('../../logging/logger-builder')(__filename)

// default timeout is low; webhook integrators should reply quickly,
// otherwise agency might end up having too many connections open
const WEBHOOK_RESPONSE_TIMEOUT_MS = process.env.WEBHOOK_RESPONSE_TIMEOUT_MS || 50
const httpAgent = new http.Agent({ keepAlive: true })
const httpsAgent = new https.Agent({ keepAlive: true })

const axiosInstance = axios.create({
  httpAgent,
  httpsAgent
})

let pendingResponseCount = 0

async function sendNotification (webhookUrl, msgUid, pwDid) {
  const notification = { msgUid, pwDid }
  const headers = {}
  const requestId = httpContext.get('reqId')
  headers['X-Request-ID'] = requestId || uuid.v4()
  if (!requestId) {
    logger.error(`Sending webhook notification but reqId was not found in httpContext. Setting X-Request-ID to '${headers['X-Request-ID']}'.`)
  }
  pendingResponseCount += 1
  logger.info(`Sending callback to url ${webhookUrl}, pendingResponseCount=${pendingResponseCount}`)
  try {
    await axiosInstance.post(webhookUrl, notification, {
      headers,
      timeout: WEBHOOK_RESPONSE_TIMEOUT_MS
    })
  } finally {
    pendingResponseCount -= 1
  }
}

module.exports = { sendNotification }
