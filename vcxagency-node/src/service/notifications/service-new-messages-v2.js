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

const assert = require('assert')
const logger = require('../../logging/logger-builder')(__filename)

function createServiceNewMessagesV2 (redisAdapter) {
  assert(redisAdapter.registerModifiedKeyCallback)
  assert(redisAdapter.subscribeKey)
  assert(redisAdapter.unsubscribeKey)
  assert(redisAdapter.getValue)
  assert(redisAdapter.setValue)
  assert(redisAdapter.deleteValue)
  assert(redisAdapter.cleanUp)

  const agentSubscriptions = {}

  function cleanUp () {
    redisAdapter.cleanUp()
  }

  redisAdapter.registerModifiedKeyCallback(async function (agentDid) {
    assert(agentDid)
    try {
      if (agentSubscriptions[agentDid]) {
        const { onNewMessageCallback } = agentSubscriptions[agentDid]
        if (!onNewMessageCallback) {
          throw Error(`Callback object for agent ${agentDid} was missing onNewMessageCallback property`)
        }
        const newMsgUtime = parseInt(await redisAdapter.getValue(agentDid))
        onNewMessageCallback(newMsgUtime)
      } else {
        logger.warn(`Received keyspace notification for key ${agentDid} but no associated callback found`)
      }
    } catch (err) {
      logger.error(`Error processing redis notification. ${err.message}`)
    }
  })

  async function _cleanupSubscription (agentDid) {
    assert(agentDid)
    logger.debug(`Cleaning up notification subscription for agent ${agentDid}`)
    agentSubscriptions[agentDid] = undefined
    await redisAdapter.unsubscribeKey(agentDid)
  }

  async function hasUnackedMessage (agentDid) {
    assert(agentDid)
    const lastMsgUtime = await redisAdapter.getValue(agentDid)
    return !!lastMsgUtime
  }

  async function getUnackedMessageTimestamp (agentDid) {
    assert(agentDid)
    const value = await redisAdapter.getValue(agentDid)
    if (value) {
      return parseInt(value)
    }
    return null
  }

  async function registerCallback (agentDid, callbackId, onNewMessageCallback) {
    assert(agentDid)
    assert(callbackId)
    assert(onNewMessageCallback)
    logger.info(`Registering agent notification callbacks ${agentDid}.`)
    agentSubscriptions[agentDid] = { onNewMessageCallback, callbackId }
    await redisAdapter.subscribeKey(agentDid)
  }

  async function cleanupCallback (agentDid, callbackId) {
    assert(agentDid)
    assert(callbackId)
    if (agentSubscriptions[agentDid] && agentSubscriptions[agentDid].callbackId === callbackId) {
      await _cleanupSubscription(agentDid)
    } else {
      logger.debug(`Tried to cleanup callback new-message callback ${callbackId} for agent ${agentDid} but it doesn't exist anymore`)
    }
  }

  async function ackNewMessage (agentDid, ackUtime) {
    assert(agentDid)
    assert(ackUtime)
    const now = Math.floor(+new Date())
    if (ackUtime > now) {
      throw Error(`Invalid ackUtime value, bigger than current time. AckUtime: ${ackUtime}, now: ${now}`)
    }
    logger.info(`Agent ${agentDid} acked new message flag`)
    const msgUtime = await redisAdapter.getValue(agentDid)
    if (msgUtime) {
      if (ackUtime >= msgUtime) {
        await _ackNewMessageAccepted(agentDid)
        logger.info(`Acked msg notification for agent ${agentDid}, ack timestamp: ${ackUtime}`)
      } else {
        logger.info(`Tried to ack msg notification for agent ${agentDid}, ack timestamp: ${ackUtime}, but this will be ignored because another message has been received later at ${msgUtime}`)
      }
    }
  }

  async function _ackNewMessageAccepted (agentDid) {
    assert(agentDid)
    await redisAdapter.deleteValue(agentDid)
    if (agentSubscriptions[agentDid]) {
      await _cleanupSubscription(agentDid)
    }
  }

  async function flagNewMessage (agentDid, msgUtime) {
    assert(agentDid)
    assert(msgUtime)
    const now = Math.floor(+new Date())
    if (msgUtime > now) {
      throw Error(`Attempted to flag new message notification with timestamp higher than current. msgUtime: ${msgUtime}, now: ${now}`)
    }
    logger.info(`Setting up notification flag for agent ${agentDid} with value of last message timestamp: ${msgUtime}`)
    await redisAdapter.setValue(agentDid, msgUtime)
  }

  return {
    ackNewMessage,
    hasUnackedMessage,
    getUnackedMessageTimestamp,
    registerCallback,
    flagNewMessage,
    cleanupCallback,
    cleanUp
  }
}

module.exports = {
  createServiceNewMessagesV2
}
