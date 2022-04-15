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
const util = require('util')

// default timeout is low; webhook integrators should reply quickly,
// otherwise agency might end up having too many connections open
const httpAgent = new http.Agent({ keepAlive: true })
const httpsAgent = new https.Agent({ keepAlive: true })

const axiosInstance = axios.create({
  httpAgent,
  httpsAgent
})

let pendingResponseCount = 0

function sendNotification (webhookUrl, msgUid, pwDid) {
  const notification = { msgUid, pwDid }
  const headers = {}
  const requestId = httpContext.get('reqId')
  headers['X-Request-ID'] = requestId || uuid.v4()
  if (!requestId) {
    logger.error(`Sending webhook notification but reqId was not found in httpContext. Setting X-Request-ID to '${headers['X-Request-ID']}'.`)
  }
  pendingResponseCount += 1
  logger.info(`Sending callback to url ${webhookUrl}, pendingResponseCount=${pendingResponseCount}`)
  const startHrTime = process.hrtime()
  let wasThrown = false
  axiosInstance.post(webhookUrl, notification, {
    headers,
    timeout: global.WEBHOOK_RESPONSE_TIMEOUT_MS
  })
    .catch(err => {
      wasThrown = true
      if (err.response) {
        logger.error(`Error response received from callback endpoint: ${err.response.status} ${err.response.statusText}`)
        logger.debug(`Error details: ${util.inspect(err.response)}`)
      } else {
        logger.error(`Error calling callback endpoint ${JSON.stringify(err.stack)}`)
      }
    })
    .finally(() => {
      pendingResponseCount -= 1
      const elapsedHrTime = process.hrtime(startHrTime)
      const elapsedTimeInMs = elapsedHrTime[0] * 1000 + elapsedHrTime[1] / 1e6
      const status = wasThrown ? 'failure' : 'success'
      logger.debug(`Finished axios call with ${status} after ${elapsedTimeInMs}ms.`)
    })
}

module.exports = { sendNotification }
