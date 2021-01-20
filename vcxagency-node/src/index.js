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
const https = require('https')
const fs = require('fs')

const appConfig = buildAppConfigFromEnvVariables()
const logger = require('./logging/logger-builder')(__filename)
logger.info(stringifyAndHideSensitive(appConfig))

async function run () {
  await validateAppConfig(appConfig)

  // Import order is important in this file - first we need to validate config, then set up logger
  // if we require any other of our files before we load/validate appConfig, that file might happen to require
  // logger, which relies on environment variables being loaded - which is side effect of calling buildAppConfigFromEnvVariables()
  // This could be improved if logger-builder wouldn't rely on environment variables, but rather having this information
  // passed in arguments
  const express = require('express')
  const apiAgency = require('./api/api-agency')
  const apiMessaging = require('./api/api-messaging')
  const apiHealth = require('./api/api-health')

  const { indyLoadPostgresPlugin } = require('easy-indysdk')
  const { wireUpApplication } = require('./app')
  const { setReqId, logRequestsWithoutBody } = require('./api/middleware')
  const { indySetLogger } = require('easy-indysdk')
  const httpContext = require('express-http-context')
  const expressWinstonLogger = require('./logging/express-logger-builder')
  const bodyParser = require('body-parser') // TODO: request parsing must be BEFORE we do stuff with winston express logger

  startup()

  function _getStorageInfoDefault () { // eslint-disable-line
    return {
      storageType: 'default',
      storageConfig: null,
      storageCredentials: null
    }
  }

  function getStorageInfoPgsql () {
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

  function addStandardErrorMidlleware (app) {
    app.use(function (err, req, res, next) {
      return res.status(err.status).json(err)
    })

    app.use(function (req, res, next) {
      res.status(404).send({ message: `Your request: '${req.originalUrl}' didn't reach any handler.` })
    })
  }

  function setupServer (entityForwardAgent, resolver, serviceNewMessages, maxRequestSizeKb, apiLimiter) {
    const appAgent = express()
    const appAgentJson = express.Router()
    const appAgentMsg = express.Router()
    const appAgentHealth = express.Router()
    appAgentMsg.use(bodyParser.raw({
      inflate: true,
      limit: `${maxRequestSizeKb}kb`,
      type: '*/*'
    }))
    appAgentJson.use(bodyParser.json())

    appAgentJson.use(httpContext.middleware)
    appAgentMsg.use(httpContext.middleware)

    appAgentJson.use(setReqId)
    appAgentMsg.use(setReqId)

    appAgentJson.use(logRequestsWithoutBody)
    appAgentMsg.use(logRequestsWithoutBody)

    appAgentJson.use(expressWinstonLogger)
    appAgentMsg.use(expressWinstonLogger)

    apiAgency(appAgentJson, entityForwardAgent, serviceNewMessages)
    apiMessaging(appAgentMsg, entityForwardAgent)
    apiHealth(appAgentHealth)

    addStandardErrorMidlleware(appAgentJson)
    addStandardErrorMidlleware(appAgentMsg)
    addStandardErrorMidlleware(appAgentHealth)

    appAgent.use('/agency/msg', appAgentMsg)
    appAgent.use('/api/health', appAgentHealth)
    appAgent.use('/', appAgentJson)

    if (apiLimiter) {
      appAgent.use(apiLimiter)
    } else {
      logger.warn('Rate limiter is not being used')
    }

    if (appConfig.SERVER_ENABLE_TLS === 'true') {
      https.createServer({
        cert: fs.readFileSync(appConfig.CERTIFICATE_PATH),
        key: fs.readFileSync(appConfig.CERTIFICATE_KEY_PATH),
        ca: appConfig.CERTIFICATE_AUTHORITY_PATH ? fs.readFileSync(appConfig.CERTIFICATE_AUTHORITY_PATH) : ''
      }, appAgent).listen(appConfig.SERVER_PORT, () => logger.info(`Agency is using TLS and listening on port ${appConfig.SERVER_PORT}!`))
    } else {
      appAgent.listen(appConfig.SERVER_PORT, () => logger.info(`Agency is listening on port ${appConfig.SERVER_PORT}!`))
    }
  }

  async function startAgency () {
    logger.info('Starting agency')
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

    const { walletStorageType, walletStorageConfig, walletStorageCredentials } = getStorageInfoPgsql()
    logger.info(`Initializing postgres plugin with config: ${JSON.stringify(walletStorageConfig)}`)
    await indyLoadPostgresPlugin(walletStorageConfig, walletStorageCredentials)

    const redisUrl = appConfig.REDIS_URL

    const agencyType = appConfig.AGENCY_TYPE

    logger.info('Building services and wiring up dependencies.')
    const { entityForwardAgent, resolver, serviceNewMessages, apiLimiter } =
      await wireUpApplication({
        appStorageConfig,
        agencyType,
        redisUrl,
        agencyWalletName,
        agencyDid,
        agencySeed,
        agencyWalletKey,
        walletStorageType,
        walletStorageConfig,
        walletStorageCredentials,
        maxRequestsPerMinute: appConfig.MAX_REQUESTS_PER_MINUTE
      })

    logger.info('Building express http server.')
    setupServer(entityForwardAgent, resolver, serviceNewMessages, appConfig.SERVER_MAX_REQUEST_SIZE_KB, apiLimiter)
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
}

run()
  .catch((err) => {
    logger.error(`Agency failed. ${err.stack}`)
    process.exit(255)
  })
