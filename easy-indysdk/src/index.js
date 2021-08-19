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

const indy = require('indy-sdk')
const crypto = require('./crypto')
const wallet = require('./wallet')
const dbutils = require('./dbutils')

function indySetLogger (winstonLogger) {
  indy.setLogger(function (level, target, message, modulePath, file, line) {
    if (level === 1) {
      winstonLogger.error(`INDYSDK: ${message}`)
    } else if (level === 2) {
      winstonLogger.warn(`INDYSDK: ${message}`)
    } else if (level === 3) {
      winstonLogger.info(`INDYSDK: ${message}`)
    } else if (level === 4) {
      winstonLogger.debug(`INDYSDK: ${message}`)
    } else {
      winstonLogger.silly(`INDYSDK: ${message}`)
    }
  })
}

function indySetDefaultLogger (pattern) {
  indy.setDefaultLogger(pattern)
}

function indyBuildGetSchemaRequest () {
  indy.buildGetSchemaRequest('Tzmf8z4UrFec6RGMEnH3F5', 'QosCTowZAZxYU5RSeMh9UJ:2:acmetestprod:1.0')
}

module.exports = { ...crypto, ...wallet, ...dbutils, indySetLogger, indySetDefaultLogger, indyBuildGetSchemaRequest }
