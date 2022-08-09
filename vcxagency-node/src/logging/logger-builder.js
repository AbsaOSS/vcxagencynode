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

const winston = require('winston')
const path = require('path')
const { jsonFormatter, tryAddRequestId, tryAddEcsTaskMetadata } = require('./logger-common')

const prettyFormatter = winston.format.combine(
  (global.DISABLE_COLOR_LOGS) ? winston.format.uncolorize({}) : winston.format.colorize({ all: true }),
  winston.format.printf(
    msg => {
      return `[${msg.timestamp}] [${msg.filename}] [${msg.level}] [requestId=${msg.requestId}]: ${msg.message}`
    }
  )
)

function createConsoleLogger (mainLoggerName, formatter, logLevel, makeItSilent = false) {
  winston.loggers.add(mainLoggerName, {
    transports: [
      new winston.transports.Console({
        silent: makeItSilent,
        level: logLevel,
        format: winston.format.combine(
          winston.format.timestamp({
            format: 'YYYY-MM-DD HH:mm:ss.SSS'
          }),
          tryAddRequestId,
          tryAddEcsTaskMetadata,
          formatter
        )
      })
    ]
  })
}

function addChildLogger (mainLoggerName, fullPath) {
  return winston.loggers.get(mainLoggerName).child({
    filename: path.basename(fullPath, path.extname(fullPath))
  })
}

const mainLoggerName = 'main'

const formatter = global.LOG_JSON_TO_CONSOLE ? jsonFormatter : prettyFormatter
const logLevel = global.LOG_LEVEL
createConsoleLogger(mainLoggerName, formatter, logLevel, global.SILENT_WINSTON === 'true')

module.exports = function (fullPath) {
  return addChildLogger(mainLoggerName, fullPath)
}
