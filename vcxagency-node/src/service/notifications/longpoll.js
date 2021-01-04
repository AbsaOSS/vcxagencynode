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
const logger = require('../../logging/logger-builder')(__filename)

module.exports.longpollNotifications = async function longpollNotifications (
  serviceNewMessages,
  agentDid,
  timeoutMs
) {
  logger.info(`Going to longpoll new message for agent ${agentDid} with timeout ${timeoutMs}ms.`)
  return new Promise(async (resolve, reject) => {
    if (await serviceNewMessages.hasNewMessage(agentDid)) {
      await resolve(true)
    } else {
      let wasResponseSent
      const callbackId = uuid.v4()

      const reactOnNewMessage = async function () {
        if (!wasResponseSent) {
          wasResponseSent = true
          serviceNewMessages.cleanupCallback(agentDid, callbackId)
          resolve(true)
        }
      }

      const reactOnTimeout = async function () {
        if (!wasResponseSent) {
          wasResponseSent = true
          serviceNewMessages.cleanupCallback(agentDid, callbackId)
          resolve(false)
        }
      }

      serviceNewMessages.registerCallback(agentDid, callbackId, reactOnNewMessage)
        .then(() => {
          setTimeout(reactOnTimeout, timeoutMs)
        })
        .catch((err) => {
          reject(err)
        })
    }
  })
}
