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

const redis = require('redis')
const logger = require('../../logging/logger-builder')(__filename)

module.exports.buildRedisClients = function buildRedisClients (redisUrl) {
  const redisClientSubscriber = redis.createClient(redisUrl)
  const redisClientRw = redis.createClient(redisUrl)

  redisClientRw.on('error', function (err) {
    logger.error(`Redis rw-client encountered error: ${err}`)
  })
  redisClientSubscriber.on('error', function (err) {
    logger.error(`Redis subscription-client encountered error: ${err}`)
  })

  redisClientRw.on('end', () => {
    logger.info('Redis rw-client disconnected')
  })
  redisClientSubscriber.on('end', () => {
    logger.info('Redis subscription-client disconnected')
  })

  redisClientRw.on('reconnecting', () => {
    logger.info('Redis rw-client reconnecting')
  })

  redisClientSubscriber.on('reconnecting', () => {
    logger.info('Redis subscription-client reconnecting')
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

  return {
    redisClientSubscriber,
    redisClientRw
  }
}
