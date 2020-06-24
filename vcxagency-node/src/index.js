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

const { validateAppConfig, stringifyAndHideSensitive } = require('./configuration/app-config')
const { buildAppConfigFromEnvVariables } = require('./configuration/app-config-loader')
const util = require('util')

const appConfig = buildAppConfigFromEnvVariables()
console.log(stringifyAndHideSensitive(appConfig))

validateAppConfig(appConfig, (err, ok) => {
  if (err) {
    throw Error(err.message)
  }
  // Import order is important in this file - first we need to validate config, then set up logger
  // if we require any other of our files before we load/validate appConfig, that file might happen to require
  // logger, which relies on environment variables being loaded - which is side effect of calling buildAppConfigFromEnvVariables()
  // This could be improved if logger-builder wouldn't rely on environment variables, but rather having this information
  // passed in arguments
  const logger = require('./logging/logger-builder')(__filename)
  const express = require('express')
  const apiAgency = require('./api/api-agency')

  const { indyLoadPostgresPlugin } = require('easy-indysdk')
  const { wireUp } = require('./app')
  const { indySetLogger } = require('easy-indysdk')
  const appAgent = express()

  startup()

  function _getStorageInfoDefault () { // eslint-disable-line
    return {
      storageType: 'default',
      storageConfig: null,
      storageCredentials: null
    }
  }

  function getStorageInfoPgsql () {
    const storageConfig = {
      url: appConfig.PG_WALLET_URL,
      // 'tls', todo: add this when tls code is merged into pgsql plugin
      max_connections: appConfig.PG_WALLET_MAX_CONNECTIONS, /// Sets the maximum number of connections managed by the pool.
      min_idle_count: appConfig.PG_WALLET_MIN_IDLE_COUNT, /// Sets the minimum idle connection count maintained by the pool.
      connection_timeout: appConfig.PG_WALLET_CONNECTION_TIMEOUT, /// Sets the idle timeout used by the pool.
      wallet_scheme: 'MultiWalletSingleTableSharedPool' // strategy used by wallet plugin
      // 'database_name' : todo: add support into pgsql for this when using MultiWalletSingleTableSharedPool strategy
    }

    const storageCredentials = {
      account: appConfig.PG_WALLET_ACCOUNT,
      password: appConfig.PG_WALLET_PASSWORD_SECRET,
      admin_account: appConfig.PG_WALLET_ADMIN_ACCOUNT,
      admin_password: appConfig.PG_WALLET_ADMIN_PASSWORD_SECRET
    }
    return {
      storageType: 'postgres_storage',
      storageConfig,
      storageCredentials
    }
  }

  async function startAgency () {
    logger.info('Starting agency')
    const agencyWalletName = appConfig.AGENCY_WALLET_NAME
    const agencyDid = appConfig.AGENCY_DID
    const agencySeed = appConfig.AGENCY_SEED_SECRET
    const agencyWalletKey = appConfig.AGENCY_WALLET_KEY_SECRET

    const appStoragePgConfig = {
      host: appConfig.PG_STORE_HOST,
      port: appConfig.PG_STORE_PORT,
      user: appConfig.PG_STORE_ACCOUNT,
      password: appConfig.PG_STORE_PASSWORD_SECRET,
      database: appConfig.PG_STORE_DATABASE
    }

    const { storageType, storageConfig, storageCredentials } = getStorageInfoPgsql()
    logger.info(`Intializing postgres plugin with config: ${JSON.stringify(storageConfig)}`)
    await indyLoadPostgresPlugin(storageConfig, storageCredentials)

    const { entityForwardAgent, resolver } =
      await wireUp(appStoragePgConfig, agencyWalletName, agencyDid, agencySeed, agencyWalletKey, storageType, storageConfig, storageCredentials)

    apiAgency(appAgent, entityForwardAgent, resolver, appConfig.SERVER_MAX_REQUEST_SIZE_KB)

    appAgent.use((err, req, res, next) => {
      return res.status(err.status).json(err)
    })

    appAgent.use(function (req, res, next) {
      res.status(404).send({ message: `Your request: '${req.originalUrl}' didn't reach any handler.` })
    })
    appAgent.listen(appConfig.SERVER_PORT, () => logger.info(`Agency is listening on port ${appConfig.SERVER_PORT}!`))
  }

  async function startup () {
    if (appConfig.LOG_ENABLE_INDYSDK === 'true') {
      indySetLogger(logger)
    }
    try {
      await startAgency()
    } catch (e) {
      logger.error(`Unhandled agency error: ${util.inspect(e)}`)
      throw Error(`Unhandled agency error: ${util.inspect(e)}`)
    }
  }
})
