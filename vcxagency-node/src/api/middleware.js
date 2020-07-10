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

const uuid = require('uuid')
const logger = require('../logging/logger-builder')(__filename)
const httpContext = require('express-http-context')

module.exports.asyncHandler = function asyncHandler (fn) {
  return (req, res, next) => {
    const result = Promise
      .resolve(fn(req, res, next))
      .catch(function (err) {
        const errorId = httpContext.get('reqId')
        logger.error(`ErrorID: '${errorId}'. Unhandled error from async express handler. Error details:`)
        logger.error(err.stack)
        res.status(500).send({ message: 'Something went wrong unexpectedly.', errorId })
      })
    return result
  }
}

module.exports.logRequestsWithoutBody = function logRequestsWithoutBody (req, res, next) {
  logger.info(`${req.method} ${req.originalUrl}`)
  next()
}

module.exports.logRequestsWithBody = function logRequestsWithBody (req, res, next) {
  logger.info(`${req.method} ${req.originalUrl} Request body: ${JSON.stringify(req.body)}`)
  next()
}

module.exports.setReqId = function setReqId (req, res, next) {
  const xRequestId = req.header('X-Request-ID') || uuid.v4()
  httpContext.set('reqId', xRequestId)
  next()
}
