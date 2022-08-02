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

module.exports.longpollNotificationsV2 = function longpollNotificationsV2 (
  serviceNewMessagesV2,
  agentDid,
  timeoutMs
) {
  logger.info(`V2 message notifications for agent ${agentDid} using timeout of ${timeoutMs}ms.`)
  return new Promise((resolve, reject) => {
    serviceNewMessagesV2.getUnackedMessageTimestamp(agentDid)
      .then((lastMsgUtime) => {
        if (lastMsgUtime) {
          resolve(lastMsgUtime)
        } else {
          let wasResponseSent
          const callbackId = uuid.v4()

          const reactOnNewMessage = async function (newMsgUtime) {
            if (!wasResponseSent) {
              wasResponseSent = true
              serviceNewMessagesV2.cleanupCallback(agentDid, callbackId)
              resolve(newMsgUtime)
            }
          }

          const reactOnTimeout = async function () {
            if (!wasResponseSent) {
              wasResponseSent = true
              serviceNewMessagesV2.cleanupCallback(agentDid, callbackId)
              resolve(null)
            }
          }

          serviceNewMessagesV2.registerCallback(agentDid, callbackId, reactOnNewMessage)
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
