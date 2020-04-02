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

const { indySetLogger } = require('easy-indysdk')

function objectToBuffer (object) {
  return Buffer.from(JSON.stringify(object))
}

function setupVcxLogging (logger) {
  if (!logger) {
    logger.error = (data) => console.error(data)
    logger.warn = (data) => console.warn(data)
    logger.info = (data) => console.log(data)
    logger.debug = (data) => console.log(data)
    logger.silly = (data) => console.log(data)
  }
  indySetLogger(logger)
}

module.exports.objectToBuffer = objectToBuffer
module.exports.setupVcxLogging = setupVcxLogging
