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
const util = require('util')
const { ErrorFeatureDisabled } = require('../errors/error-feature-disabled')
const { ValidationError } = require('express-validation')

module.exports.finalExpressHandlers = function finalExpressHandlers (app) {
  app.use('*', function (req, res) {
    res.status(404).send({ message: `Your request: '${req.originalUrl}' didn't reach any handler.` })
  })

  app.use(function (err, req, res, next) {
    if (err instanceof ValidationError) {
      return res.status(err.statusCode).json(err)
    }
    logger.error(`Unhandled error catched by express middleware. ${util.inspect(err, { showHidden: false, depth: 4 })}`)
    res.status(500).send()
  })
}

module.exports.asyncHandler = function asyncHandler (fn) {
  return (req, res, next) => {
    const result = Promise
      .resolve(fn(req, res, next))
      .catch(function (err) {
        const traceId = httpContext.get('reqId')
        const responsePayload = { 'trace-id': traceId }
        if (err instanceof ErrorFeatureDisabled) {
          responsePayload.message = err.message
          logger.error(`ErrorFeatureDisabled. Error: ${JSON.stringify(responsePayload)}`)
          res.status(409).send({ error: responsePayload })
        } else {
          logger.error(`Unexpected error: '${traceId}'. Unhandled error from async express handler. Error details:`)
          logger.error(err.stack)
          res.status(500).send({ message: `Something went wrong unexpectedly. traceId=${traceId}`, errorId: traceId })
        }
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
