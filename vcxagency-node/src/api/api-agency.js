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
const logger = require('../logging/logger-builder')(__filename)
const { longpollNotifications } = require('../service/notifications/longpoll')

module.exports = function (app, forwardAgent, serviceNewMessages) {
  app.get('/agency',
    asyncHandler(async function (req, res) {
      const { did, verkey } = forwardAgent.getForwadAgentInfo()
      res.header('Cache-Control', 'private, no-cache, no-store, must-revalidate')
      res.status(200).send({ DID: did, verKey: verkey })
    }))

  app.get('/experimental/agent/:agentDid/notifications',
    asyncHandler(async function (req, res) {
      const { agentDid } = req.params
      const timeoutMs = req.body.timeout || 30000
      const start = Date.now()
      const hasNotifications = await longpollNotifications(serviceNewMessages, agentDid, timeoutMs)
      const duration = Date.now() - start
      logger.info(`Returning long-poll after ${duration}ms for agent ${agentDid}. Has new message = ${hasNotifications}.`)
      res.header('Cache-Control', 'private, no-cache, no-store, must-revalidate')
      res.status(200).send({ hasNotifications })
    })
  )

  app.post('/experimental/agent/:agentDid/notifications/ack',
    asyncHandler(async function (req, res) {
      const { agentDid } = req.params
      await serviceNewMessages.ackNewMessage(agentDid)
      res.status(200).send()
    })
  )
}
