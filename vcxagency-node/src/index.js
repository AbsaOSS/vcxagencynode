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
const express = require('express')

/*
** No logger section **
*
* In following section we do not use, or import a file which does, winston logger builder.
* Logger builder depends on app configuration loaded first, and that's what we do bellow.
*/
async function loadConfiguration () {
  const { buildAppConfigFromEnvVariables } = require('./configuration/app-config-loader')
  const { validateAppConfig } = require('./configuration/app-config')
  const rawAppConfig = buildAppConfigFromEnvVariables()
  const appConfig = await validateAppConfig(rawAppConfig)
  global.DISABLE_COLOR_LOGS = appConfig.DISABLE_COLOR_LOGS
  global.LOG_JSON_TO_CONSOLE = appConfig.LOG_JSON_TO_CONSOLE
  global.WEBHOOK_RESPONSE_TIMEOUT_MS = appConfig.WEBHOOK_RESPONSE_TIMEOUT_MS
  global.LOG_LEVEL = appConfig.LOG_LEVEL
  global.EXPLAIN_QUERIES = appConfig.EXPLAIN_QUERIES
  return appConfig
}

async function startApp (appConfig) {
  // only after global variables have been set we can import files which work with logger
  const logger = require('./logging/logger-builder')(__filename)
  const { fetchEcsTaskMetadata } = require('./scripts/fetch-ecs-task-metadata')
  const { reloadTrustedCerts, createWebServer } = require('./setup/server')
  const { fetchCertsFromS3 } = require('./scripts/download-certs')
  try {
    process.on('exit', code => {
      logger.warn(`Process exiting with code: ${code}`)
    })

    process.on('SIGTERM', signal => {
      logger.warn(`Process ${process.pid} received a SIGTERM signal.`)
      process.exit(0)
    })

    process.on('SIGINT', signal => {
      logger.warn(`Process ${process.pid} has been interrupted.`)
      process.exit(0)
    })

    const { stringifyAndHideSensitive } = require('./configuration/app-config')
    const { buildApplication } = require('./setup/app')
    const { setupExpressApp } = require('./setup/server')

    logger.info(`Starting up application with effective config: ${stringifyAndHideSensitive(appConfig)}`)

    logger.info('Attempting to fetch and store ECS task metadata')
    global.ecsTaskMetadata = await fetchEcsTaskMetadata(appConfig.ECS_CONTAINER_METADATA_URI_V4)

    logger.debug('Going to try reloading trusted certificates.')
    reloadTrustedCerts(logger)

    logger.info(`Loaded effective config: ${stringifyAndHideSensitive(appConfig)}`)

    logger.debug('Going to fetch certificates/keys to serve.')
    await fetchCertsFromS3(appConfig, logger)

    logger.debug('Going to build application internals.')
    const application = await buildApplication(appConfig)

    const expressApp = express()
    expressApp.set('app-name', 'vcxs-api')

    const httpServer = createWebServer(expressApp, appConfig.SERVER_ENABLE_TLS, appConfig.CERTIFICATE_PATH, appConfig.CERTIFICATE_KEY_PATH, logger)
    await setupExpressApp(expressApp, application, appConfig)

    const port = appConfig.SERVER_PORT
    logger.debug(`Going to listen on port ${port}`)
    httpServer.listen(port, () => logger.info(`------------ Listening on port ${port} ------------`))
  } catch (err) {
    logger.error(`Unhandled error. Application will be terminated. ${err.stack}`)
    process.exit(255)
  }
}

async function run () {
  const appConfig = await loadConfiguration()
  return startApp(appConfig)
}

run()
  .catch(err => {
    console.error(`Unhandled error. Application will be terminated. ${err.stack}`)
    process.exit(255)
  })
