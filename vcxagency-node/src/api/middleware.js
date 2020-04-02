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
const util = require('util')

const asyncHandler = fn => (req, res, next) => {
  return Promise
    .resolve(fn(req, res, next))
    .catch(function (err) {
      const errorId = uuid.v4()
      logger.error(`Unhandled error from async express handler. ErrorId: ${errorId} Error details: ${util.inspect(err)}`)
      res.status(500).send({ message: 'Something went wrong unexpectedly.', errorId })
    })
}

module.exports = { asyncHandler }
