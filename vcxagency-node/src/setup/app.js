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

const { createPgStorageEntities } = require('../service/storage/pgstorage-entities')
const { createRouter } = require('../service/delivery/router')
const { createResolver } = require('../service/delivery/resolver')
const { buildForwardAgent } = require('../service/entities/fwa/entity-fwa')
const { createServiceIndyWallets } = require('../service/state/service-indy-wallets')
const { assureDb } = require('../service/storage/pgdb')
const { createServiceNewMessages } = require('../service/notifications/service-new-messages')
const { createServiceNewMessagesUnavailable } = require('../service/notifications/service-new-messages-unavailable')
const { waitUntilConnectsToPostgres } = require('../service/storage/pgstorage-entities')
const { buildRedisClients } = require('../service/storage/redis-client-builder')
const logger = require('../logging/logger-builder')(__filename)
const assert = require('assert')
const { indyLoadPostgresPlugin } = require('easy-indysdk')
const { indySetLogger } = require('easy-indysdk')

function _getStorageInfoDefault () { // eslint-disable-line
  return {
    storageType: 'default',
    storageConfig: null,
    storageCredentials: null
  }
}

function getStorageInfoPgsql (appConfig) {
  const walletStorageConfig = {
    url: appConfig.PG_WALLET_URL,
    // 'tls', todo: add this when tls code is merged into pgsql plugin
    max_connections: appConfig.PG_WALLET_MAX_CONNECTIONS, /// Sets the maximum number of connections managed by the pool.
    min_idle_count: appConfig.PG_WALLET_MIN_IDLE_COUNT, /// Sets the minimum idle connection count maintained by the pool.
    connection_timeout: appConfig.PG_WALLET_CONNECTION_TIMEOUT, /// Sets the idle timeout used by the pool.
    wallet_scheme: 'MultiWalletSingleTableSharedPool' // strategy used by wallet plugin
    // 'database_name' : todo: add support into pgsql for this when using MultiWalletSingleTableSharedPool strategy
  }

  const walletStorageCredentials = {
    account: appConfig.PG_WALLET_ACCOUNT,
    password: appConfig.PG_WALLET_PASSWORD_SECRET,
    admin_account: appConfig.PG_WALLET_ADMIN_ACCOUNT,
    admin_password: appConfig.PG_WALLET_ADMIN_PASSWORD_SECRET
  }
  return {
    walletStorageType: 'postgres_storage',
    walletStorageConfig,
    walletStorageCredentials
  }
}

async function buildApplication (appConfig) {
  const agencyWalletName = appConfig.AGENCY_WALLET_NAME
  const agencyDid = appConfig.AGENCY_DID
  const agencySeed = appConfig.AGENCY_SEED_SECRET
  const agencyWalletKey = appConfig.AGENCY_WALLET_KEY_SECRET

  const appStorageConfig = {
    host: appConfig.PG_STORE_HOST,
    port: appConfig.PG_STORE_PORT,
    user: appConfig.PG_STORE_ACCOUNT,
    password: appConfig.PG_STORE_PASSWORD_SECRET,
    database: appConfig.PG_STORE_DATABASE
  }
  if (appConfig.LOG_ENABLE_INDYSDK === 'true') {
    indySetLogger(logger)
  }
  const { walletStorageType, walletStorageConfig, walletStorageCredentials } = getStorageInfoPgsql(appConfig)
  logger.info(`Initializing postgres plugin with config: ${JSON.stringify(walletStorageConfig)}`)
  await indyLoadPostgresPlugin(walletStorageConfig, walletStorageCredentials)

  const redisUrl = appConfig.REDIS_URL
  const agencyType = appConfig.AGENCY_TYPE

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
    const { redisClientSubscriber, redisClientRw } = buildRedisClients(redisUrl)
    serviceNewMessages = createServiceNewMessages(redisClientSubscriber, redisClientRw)
  } else {
    throw Error(`Unknown agency type ${agencyType}`)
  }

  const serviceIndyWallets = await createServiceIndyWallets(walletStorageType, walletStorageConfig, walletStorageCredentials)
  const { user, password, host, port, database } = appStorageConfig
  await waitUntilConnectsToPostgres(appStorageConfig, 5, 2000)
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

module.exports = {
  buildApplication,
  cleanUpApplication
}
