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
const httpContext = require('express-http-context')

const tryAddRequestId = winston.format.combine(
  winston.format.printf(info => {
    info.expressRequestId = httpContext.get('reqId')
    return info
  })
)

const characterTruncater = lengthLimit => {
  return winston.format.combine(
    winston.format.printf(info => {
      const m = info.message
      if (typeof m === 'string') {
        const tailLength = Math.floor(lengthLimit / 2)
        const filler = `[${Math.floor(m.length - lengthLimit)} chars]`
        info.message = (m.length < lengthLimit) ? m : (m.substring(0, tailLength) + filler + m.substring(m.length - tailLength, m.length))
      }
      return info
    })
  )
}

const jsonFormatter = winston.format.combine(
  winston.format.printf(
    info => JSON.stringify(info).replace(/\\n/g, '\\n').replace(/\\t/g, '\\t')
  )
)

module.exports.characterTruncater = characterTruncater
module.exports.jsonFormatter = jsonFormatter
module.exports.tryAddRequestId = tryAddRequestId
