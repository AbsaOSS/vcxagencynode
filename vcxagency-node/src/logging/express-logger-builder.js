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
const expressWinston = require('express-winston')
const { jsonFormatter, tryAddRequestId } = require('./logger-common')

const prettyFormatterForExpress = winston.format.combine(
  winston.format.colorize({ all: true }),
  winston.format.printf(
    info => {
      return `[${info.timestamp}] [express-logger] [${info.level}] [expressRequestId=${info.expressRequestId}]: ${info.message}`
    }
  )
)

function createExpressWinstonLogger (formatter) {
  return expressWinston.logger({
    transports: [
      new winston.transports.Console()
    ],
    format: winston.format.combine(
      winston.format.timestamp({
        format: 'YYYY-MM-DD HH:mm:ss.SSS'
      }),
      tryAddRequestId,
      formatter
    ),
    meta: true, // whether request metadata shall be logged
    msg: 'HTTP {{req.method}} {{req.url}}',
    expressFormat: true, // Use the default Express/morgan request formatting. Enabling this will override any msg if true. Will only output colors with colorize set to true
    colorize: false, // Color the text and status code, using the Express/morgan color palette (text: gray, status: default green, 3XX cyan, 4XX yellow, 5XX red).
    ignoreRoute: function (req, res) { return false } // optional: allows to skip some log messages based on request and/or response
  })
}

const formatter = process.env.LOG_JSON_TO_CONSOLE === 'true' ? jsonFormatter : prettyFormatterForExpress

module.exports = createExpressWinstonLogger(formatter)
