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

const { asyncHandler } = require('./middleware')

module.exports = function (expressRouter, forwardAgent) {
  expressRouter.post('/',
    asyncHandler(async function (req, res) {
      const responseData = await forwardAgent.handleIncomingMessage(req.body)
      const { errorTraceId } = responseData
      if (errorTraceId) {
        res.set('content-type', 'application/json')
        return res.status(500).send({ errorTraceId })
      }
      res.set('content-type', 'application/ssi-agent-wire')
      res.status(200).send(responseData)
    }))
}
