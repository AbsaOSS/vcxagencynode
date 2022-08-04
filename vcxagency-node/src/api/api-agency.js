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
const { longpollNotificationsV2 } = require('../service/notifications/longpoll-v2')

module.exports = function (app, forwardAgent, serviceNewMessagesV1, serviceNewMessagesV2) {
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
      const hasNotifications = await longpollNotifications(serviceNewMessagesV1, agentDid, timeoutMs)
      const duration = Date.now() - start
      logger.info(`Returning long-poll after ${duration}ms for agent ${agentDid}. Has new message = ${hasNotifications}.`)
      res.header('Cache-Control', 'private, no-cache, no-store, must-revalidate')
      res.status(200).send({ hasNotifications })
    })
  )

  app.post('/experimental/agent/:agentDid/notifications/ack',
    asyncHandler(async function (req, res) {
      const { agentDid } = req.params
      await serviceNewMessagesV1.ackNewMessage(agentDid)
      res.status(200).send()
    })
  )

  app.get('/agent/:agentDid/notifications',
    asyncHandler(async function (req, res) {
      const { agentDid } = req.params
      const timeoutMs = req.query.timeout ? parseInt(req.query.timeout) : 30000
      const start = Date.now()
      const unackedTimestamp = await longpollNotificationsV2(serviceNewMessagesV2, agentDid, timeoutMs)
      const duration = Date.now() - start
      if (unackedTimestamp) {
        logger.info(`Returning long-poll after ${duration}ms for agent ${agentDid}. Found unacked message with timestamp: ${unackedTimestamp}`)
      } else {
        logger.info(`Returning long-poll after ${duration}ms for agent ${agentDid}. No unacked message found.`)
      }
      res.header('Cache-Control', 'private, no-cache, no-store, must-revalidate')
      res.status(200).send({ unackedTimestamp })
    })
  )

  app.post('/agent/:agentDid/notifications/ack',
    asyncHandler(async function (req, res) {
      const { agentDid } = req.params
      const { ackTimestamp } = req.body
      if (!ackTimestamp) {
        return res.status(404).send("Required body field 'lastMsgUtime' was missing.")
      }
      if (typeof ackTimestamp !== 'number') {
        return res.status(404).send("Required body field 'lastMsgUtime' is expected to be of type number.")
      }
      await serviceNewMessagesV2.ackNewMessage(agentDid, ackTimestamp)
      res.status(200).send()
    })
  )
}
