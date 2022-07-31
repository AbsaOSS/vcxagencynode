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

const logger = require('../../logging/logger-builder')(__filename)

function createServiceNewMessages (redisAdaptor) {
  const agentSubscriptions = {}

  function cleanUp () {
    redisAdaptor.cleanupResources()
  }

  redisAdaptor.registerModifiedKeyCallback(async function (agentDid) {
    try {
      if (agentSubscriptions[agentDid]) {
        const { onNewMessageCallback } = agentSubscriptions[agentDid]
        if (!onNewMessageCallback) {
          throw Error(`Callback object for agent ${agentDid} was missing onNewMessageCallback property`)
        }
        onNewMessageCallback()
      } else {
        logger.warn(`Received keyspace notification for key ${agentDid} but no associated callback found`)
      }
    } catch (err) {
      logger.error(`Error processing redis notification. ${err.message}`)
    }
  })

  async function _cleanupSubscription (agentDid) {
    logger.debug(`Cleaning up notification subscription for agent ${agentDid}`)
    agentSubscriptions[agentDid] = undefined
    await redisAdaptor.unsubscribeKey(agentDid)
  }

  async function hasNewMessage (agentDid) {
    return (await redisAdaptor.getValue(agentDid)) === 'true'
  }

  async function registerCallback (agentDid, callbackId, onNewMessageCallback) {
    logger.info(`Registering agent notification callbacks ${agentDid}.`)
    agentSubscriptions[agentDid] = { onNewMessageCallback, callbackId }
    await redisAdaptor.subscribeKey(agentDid)
  }

  async function cleanupCallback (agentDid, callbackId) {
    if (agentSubscriptions[agentDid] && agentSubscriptions[agentDid].callbackId === callbackId) {
      await _cleanupSubscription(agentDid)
    } else {
      logger.debug(`Tried to cleanup callback new-message callback ${callbackId} for agent ${agentDid} but it doesn't exist anymore`)
    }
  }

  async function ackNewMessage (agentDid) {
    logger.info(`Agent ${agentDid} acked new message flag`)
    await redisAdaptor.deleteValue(agentDid)
    if (agentSubscriptions[agentDid]) {
      await _cleanupSubscription(agentDid)
    }
  }

  async function flagNewMessage (agentDid) {
    logger.info(`Agent ${agentDid} flagged with new message`)
    await redisAdaptor.setValue(agentDid, 'true')
  }

  return {
    ackNewMessage,
    hasNewMessage,
    registerCallback,
    flagNewMessage,
    cleanupCallback,
    cleanUp
  }
}

module.exports = {
  createServiceNewMessages
}
