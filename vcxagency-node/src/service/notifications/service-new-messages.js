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
const util = require('util')

function isKeyspaceSetNotification (channel, message) {
  return (channel.match(/^__keyspace@0__:.*/) && message === 'set')
}

function _extractKey (keyspaceNotificationChannel) {
  return keyspaceNotificationChannel.slice(keyspaceNotificationChannel.indexOf(':') + 1)
}

module.exports.createServiceNewMessages = function createServiceNewMessages (redisClientSubscriber, redisClientRw) {
  const agentSubscriptions = {}

  const redisSet = util.promisify(redisClientRw.set).bind(redisClientRw)
  const redisGet = util.promisify(redisClientRw.get).bind(redisClientRw)
  const redisDel = util.promisify(redisClientRw.del).bind(redisClientRw)
  const redisSubscribe = util.promisify(redisClientSubscriber.subscribe).bind(redisClientSubscriber)

  function cleanUp () {
    redisClientSubscriber.quit()
    redisClientRw.quit()
  }

  redisClientRw.on('error', function (err) {
    logger.error(`Redis rw-client encountered error: ${err}`)
  })
  redisClientSubscriber.on('error', function (err) {
    logger.error(`Redis subscription-client encountered error: ${err}`)
  })

  redisClientRw.on('end', () => {
    console.log('Redis rw-client disconnected')
  })
  redisClientSubscriber.on('end', () => {
    console.log('Redis subscription-client disconnected')
  })

  redisClientRw.on('reconnecting', () => {
    console.log('Redis rw-client reconnecting')
  })

  redisClientSubscriber.on('reconnecting', () => {
    console.log('Redis subscription-client reconnecting')
  })

  redisClientRw.on('connect', function () {
    logger.info('Redis rw-client connected.')
  })
  redisClientSubscriber.on('connect', function () {
    logger.info('Redis subscription-client connected.')
  })

  redisClientSubscriber.on('subscribe', function (channel, _count) {
    logger.info(`Subscribed on channel ${channel}.`)
  })

  redisClientSubscriber.on('unsubscribe', function (channel, _count) {
    logger.info(`Unsubscribed on channel ${channel}.`)
  })

  redisClientSubscriber.on('message', async function (channel, message) {
    try {
      if (isKeyspaceSetNotification(channel, message)) {
        const modifiedKey = _extractKey(channel)
        logger.info(`Received keyspace-set notification on key ${message}`)
        await _processModifiedKeyNotification(modifiedKey)
      } else {
        logger.warn(`Received notification, but it's not keyspace-set. Will be ignored. Channel=${channel} Message=${message}`)
      }
    } catch (err) {
      logger.error(`Error processing redis notification. ${err.message}`)
    }
  })

  async function _processModifiedKeyNotification (key) {
    if (agentSubscriptions.key) {
      const { onNewMessageCallback } = agentSubscriptions.key
      if (!onNewMessageCallback) {
        throw Error('Agent notification onNewMessageCallback entry was missing onNewMessageCallback value.')
      }
      onNewMessageCallback()
    } else {
      logger.warn(`Received keyspace notification for key ${key} but no agent onNewMessageCallback exists.`)
    }
  }

  function _cleanupSubscription (agentDid) {
    logger.debug(`Cleaning up notification subscription for agent ${agentDid}.`)
    agentSubscriptions.agentDid = undefined
    redisClientSubscriber.unsubscribe(`__keyspace@0__:${agentDid}`)
  }

  async function hasNewMessage (agentDid) {
    return (await redisGet(agentDid)) === 'true'
  }

  async function registerCallback (agentDid, callbackId, onNewMessageCallback) {
    logger.info(`Registering agent notification callbacks ${agentDid}.`)
    agentSubscriptions.agentDid = { onNewMessageCallback, callbackId }
    await redisSubscribe(`__keyspace@0__:${agentDid}`)
  }

  function cleanupCallback (agentDid, callbackId) {
    if (agentSubscriptions.agentDid && agentSubscriptions.agentDid.callbackId === callbackId) {
      _cleanupSubscription(agentDid)
    } else {
      logger.debug(`Tried to cleanup callback new-message callback ${callbackId} for agent ${agentDid} but it doesn't exist anymore.`)
    }
  }

  async function ackNewMessage (agentDid) {
    await redisDel(agentDid)
    if (agentSubscriptions.agentDid) {
      _cleanupSubscription(agentDid)
    }
  }

  async function flagNewMessage (agentDid) {
    logger.info(`Agent ${agentDid} being flagged for new message.`)
    await redisSet(agentDid, 'true')
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
