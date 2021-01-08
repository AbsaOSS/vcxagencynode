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

const { createPgStorageEntities } = require('./service/storage/pgstorage-entities')
const { createRouter } = require('./service/delivery/router')
const { createResolver } = require('./service/delivery/resolver')
const { buildForwardAgent } = require('./service/entities/fwa/entity-fwa')
const { createServiceIndyWallets } = require('./service/state/service-indy-wallets')
const { assureDb } = require('./service/storage/pgdb')
const { createServiceNewMessages } = require('./service/notifications/service-new-messages')
const { createServiceNewMessagesUnavailable } = require('./service/notifications/service-new-messages-unavailable')
const logger = require('./logging/logger-builder')(__filename)
const redis = require('redis')
const assert = require('assert')

async function wireUpApplication ({
  appStorageConfig,
  agencyType,
  redisUrl,
  agencyWalletName,
  agencyDid,
  agencySeed,
  agencyWalletKey,
  walletStorageType = 'default',
  walletStorageConfig = null,
  walletStorageCredentials = null
}
) {
  assert(appStorageConfig, 'Missing appStorageConfig.')
  assert(agencyType, 'Missing agencyType.')
  assert(agencyWalletName, 'Missing agencyWalletName.')
  assert(agencyDid, 'Missing agencyDid.')
  assert(agencySeed, 'Missing agencySeed.')
  assert(agencyWalletKey, 'Missing agencyWalletKey.')
  assert(walletStorageType, 'Missing walletStorageType.')
  if (walletStorageType !== 'default') {
    assert(walletStorageConfig, 'Not using default wallet type and missing walletStorageConfig.')
    assert(walletStorageCredentials, 'Not using default wallet type and missing walletStorageCredentials.')
  }

  let serviceNewMessages
  if (agencyType === 'enterprise') {
    serviceNewMessages = createServiceNewMessagesUnavailable()
  } else if (agencyType === 'client') {
    if (!redisUrl) {
      throw Error('Redis URL was not provided.')
    }
    const redisClientSubscriber = redis.createClient(redisUrl)
    const redisClientRw = redis.createClient(redisUrl)
    redisClientRw.on('error', function (err) {
      logger.error(`Redis rw-client encountered error: ${err}`)
    })
    redisClientSubscriber.on('error', function (err) {
      logger.error(`Redis subscription-client encountered error: ${err}`)
    })
    redisClientRw.on('connect', function () {
      logger.info('Redis rw-client connected.')
    })
    redisClientSubscriber.on('connect', function () {
      logger.info('Redis subscription-client connected.')
    })
    serviceNewMessages = createServiceNewMessages(redisClientSubscriber, redisClientRw)
  } else {
    throw Error(`Unknown agency type ${agencyType}`)
  }

  const serviceIndyWallets = await createServiceIndyWallets(walletStorageType, walletStorageConfig, walletStorageCredentials)
  const { user, password, host, port, database } = appStorageConfig
  await assureDb(user, password, host, port, database)
  const serviceStorage = await createPgStorageEntities(appStorageConfig)
  const entityForwardAgent = await buildForwardAgent(serviceIndyWallets, serviceStorage, agencyWalletName, agencyWalletKey, agencyDid, agencySeed)
  const resolver = createResolver(serviceIndyWallets, serviceStorage, serviceNewMessages, entityForwardAgent)
  const router = createRouter(resolver)
  resolver.setRouter(router)
  entityForwardAgent.setRouter(router)
  entityForwardAgent.setResolver(resolver)
  const application = { serviceIndyWallets, serviceStorage, entityForwardAgent, resolver, router, serviceNewMessages }
  return application
}

async function cleanUpApplication (application) {
  logger.info('Cleaning up application resources.')
  application.serviceNewMessages.cleanUp()
  application.serviceStorage.cleanUp()
}

module.exports = { wireUpApplication, cleanUpApplication }
