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

module.exports.longpollNotifications = function longpollNotifications (
  serviceNewMessagesV1,
  agentDid,
  timeoutMs
) {
  logger.info(`V1 message notifications for agent ${agentDid} using timeout of ${timeoutMs}ms.`)
  return new Promise((resolve, reject) => {
    serviceNewMessagesV1.hasUnackedMessage(agentDid)
      .then((hasUnackedMessage) => {
        if (hasUnackedMessage) {
          resolve(true)
        } else {
          let wasResponseSent
          const callbackId = uuid.v4()

          const reactOnNewMessage = async function () {
            if (!wasResponseSent) {
              wasResponseSent = true
              serviceNewMessagesV1.cleanupNewMessageCallback(agentDid, callbackId)
              resolve(true)
            }
          }

          const reactOnTimeout = async function () {
            if (!wasResponseSent) {
              wasResponseSent = true
              serviceNewMessagesV1.cleanupNewMessageCallback(agentDid, callbackId)
              resolve(false)
            }
          }
          serviceNewMessagesV1.registerNewMessageCallback(agentDid, callbackId, reactOnNewMessage)
            .then(() => {
              setTimeout(reactOnTimeout, timeoutMs)
            })
            .catch((err) => {
              reject(err)
            })
        }
      })
      .catch((err) => {
        reject(err)
      })
  })
}
