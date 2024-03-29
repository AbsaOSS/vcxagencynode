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
    info.requestId = httpContext.get('reqId')
    return info
  })
)

const tryAddEcsTaskMetadata = winston.format.combine(
  winston.format.printf(info => {
    info.ecsTaskMetadata = global.ecsTaskMetadata
    return info
  })
)

const jsonFormatter = winston.format.combine(
  winston.format.printf(
    info => JSON.stringify(info)
  )
)

module.exports.jsonFormatter = jsonFormatter
module.exports.tryAddRequestId = tryAddRequestId
module.exports.tryAddEcsTaskMetadata = tryAddEcsTaskMetadata
