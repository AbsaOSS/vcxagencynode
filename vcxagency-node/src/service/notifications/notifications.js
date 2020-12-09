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

const sleep = require('sleep-promise')
const logger = require('../../logging/logger-builder')(__filename)

module.exports.createPollNotificationService = function createPollNotificationService (resolver) {
  async function pollHasNewMessage (agentDid, waitThresholdSeconds) {
    if (waitThresholdSeconds <= 0) {
      throw Error('Invalid threshold, must be more than 0.')
    }
    if (waitThresholdSeconds > 120) {
      throw Error('Invalid threshold, must be less or equal 120.')
    }
    const agentAo = await resolver.resolveAgentAOByDid(agentDid)
    if (!agentAo) {
      throw Error(`No Agent Entity was resolved by agent did ${agentDid}`)
    }
    const utimeSecNow = Math.floor(new Date() / 1000)
    const utimeSecEnd = utimeSecNow + waitThresholdSeconds
    let internalPollCount = 0
    while (true) {
      logger.debug(`Notification longpoll for agent ${agentDid} internalPollCount=${internalPollCount}`)
      const hasMessage = await agentAo.experimentalGetHasNewMessage()
      if (hasMessage) {
        logger.debug(`Notification longpoll for agent ${agentDid} terminated per discovered new message. internalPollCount=${internalPollCount}`)
        return hasMessage
      }
      const utimeSecNow = Math.floor(new Date() / 1000)
      if (utimeSecNow >= utimeSecEnd) {
        logger.debug(`Notification longpoll for agent ${agentDid} terminated per timeout. internalPollCount=${internalPollCount}`)
        return hasMessage
      }
      await sleep(1000)
      internalPollCount += 1
    }
  }

  async function ackNewMessage (agentDid) {
    const agentAo = await resolver.resolveAgentAOByDid(agentDid)
    if (!agentAo) {
      throw Error(`No Agent Entity was resolved by agent did ${agentDid}`)
    }
    logger.debug(`NewMessages status acked for agent ${agentDid}`)
    await agentAo.experimentalSetHasNewMessage(false)
  }

  return {
    pollHasNewMessage,
    ackNewMessage
  }
}
