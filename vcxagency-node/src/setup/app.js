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
const { indyBuildGetSchemaRequest } = require('../../../easy-indysdk')
const { indySetDefaultLogger } = require('easy-indysdk')
const sleep = require('sleep-promise')
const { assureMysqlDatabase } = require('easy-indysdk')
const { indyBuildMysqlStorageCredentials } = require('../../../easy-indysdk')
const { indyBuildMysqlStorageConfig } = require('../../../easy-indysdk')

function _getStorageInfoDefault () { // eslint-disable-line
  return {
    storageType: 'default',
    storageConfig: null,
    storageCredentials: null
  }
}

function getStorageInfoMysql (appConfig) {
  const walletStorageConfig = indyBuildMysqlStorageConfig(
    appConfig.MYSQL_WALLET_HOST,
    appConfig.MYSQL_WALLET_HOST,
    appConfig.MYSQL_WALLET_PORT,
    appConfig.MYSQL_WALLET_DBNAME,
    appConfig.MYSQL_WALLET_CONNECTION_LIMIT
  )
  const walletStorageCredentials = indyBuildMysqlStorageCredentials(
    appConfig.MYSQL_WALLET_ACCOUNT,
    appConfig.MYSQL_WALLET_PASSWORD_SECRET
  )
  return {
    walletStorageType: 'mysql',
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
    logger.info('Enabling indy logs.')
    indySetDefaultLogger('trace')
  }

  await indyBuildGetSchemaRequest()
  logger.info('indyBuildGetSchemaRequest was called')
  await sleep(3000)

  let walletStorageType, walletStorageConfig, walletStorageCredentials
  if (appConfig.WALLET_TYPE === 'mysql') {
    const walletDbName = appConfig.MYSQL_WALLET_DBNAME
    await assureMysqlDatabase(walletDbName, appConfig.MYSQL_WALLET_HOST, appConfig.MYSQL_WALLET_PORT, appConfig.MYSQL_WALLET_ACCOUNT, appConfig.MYSQL_WALLET_PASSWORD_SECRET);
    ({ walletStorageType, walletStorageConfig, walletStorageCredentials } = getStorageInfoMysql(appConfig))
  } else {
    throw Error(`Unsupported storage type ${appConfig.WALLET_TYPE}`)
  }

  const redisUrl = appConfig.REDIS_URL
  const agencyType = appConfig.AGENCY_TYPE

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
