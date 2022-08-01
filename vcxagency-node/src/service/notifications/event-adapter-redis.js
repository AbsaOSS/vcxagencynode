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

const util = require('util')
const { buildRedisClients } = require('../storage/redis-client-builder')
const logger = require('../../logging/logger-builder')(__filename)

function buildRedisAdapter (redisUrl) {
  const redisPath = new URL(redisUrl).pathname
  const keyspaceNumber = parseInt(redisPath.split('/')[1])

  const keyspace = `__keyspace@${keyspaceNumber}__`
  const keyspaceRegex = new RegExp(`^${keyspace}:.*`)

  const { redisClientSubscriber, redisClientRw } = buildRedisClients(redisUrl)
  const redisSet = util.promisify(redisClientRw.set).bind(redisClientRw)
  const redisGet = util.promisify(redisClientRw.get).bind(redisClientRw)
  const redisDel = util.promisify(redisClientRw.del).bind(redisClientRw)
  const redisSubscribe = util.promisify(redisClientSubscriber.subscribe).bind(redisClientSubscriber)
  const redisUnsubscribe = util.promisify(redisClientSubscriber.unsubscribe).bind(redisClientSubscriber)

  function isOurKeyspaceSetNotification (channel, message) {
    return message === 'set' && channel.match(keyspaceRegex)
  }

  function extractRedisNotificationKey (keyspaceNotificationChannel) {
    return keyspaceNotificationChannel.slice(keyspaceNotificationChannel.indexOf(':') + 1)
  }

  const registerModifiedKeyCallback = function (callback) {
    redisClientSubscriber.on('message', async function (channel, message) {
      try {
        if (isOurKeyspaceSetNotification(channel, message)) {
          const modifiedKey = extractRedisNotificationKey(channel)
          await callback(modifiedKey)
        } else {
          logger.warn(`Received notification, but it's not keyspace-set. Will be ignored. Channel=${channel} Message=${message}`)
        }
      } catch (err) {
        logger.error(`Callback failed to process redis event notification. ${err.message}`)
      }
    })
  }

  redisClientRw.on('error', function (err) {
    logger.error(`Redis rw client for redis ${redisUrl} encountered error: ${err}`)
  })

  redisClientSubscriber.on('error', function (err) {
    logger.error(`Redis subscription client for redis ${redisUrl} encountered error: ${err}`)
  })

  const subscribeKey = async (agentDid) => {
    return redisSubscribe(`${keyspace}:${agentDid}`)
  }

  const unsubscribeKey = async (agentDid) => {
    return redisUnsubscribe(`${keyspace}:${agentDid}`)
  }

  const cleanUp = () => {
    redisClientSubscriber.quit()
    redisClientRw.quit()
  }

  const setValue = async (agentDid, value) => {
    return redisSet(agentDid, value)
  }

  const getValue = async (agentDid) => {
    return redisGet(agentDid)
  }

  const deleteValue = async (agentDid) => {
    return redisDel(agentDid)
  }

  return {
    registerModifiedKeyCallback,
    subscribeKey,
    unsubscribeKey,
    setValue,
    getValue,
    deleteValue,
    cleanUp
  }
}

module.exports = { buildRedisAdapter }
