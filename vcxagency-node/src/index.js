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
const { buildAppConfigFromEnvVariables } = require('./configuration/app-config-loader')
const { validateFinalConfig, stringifyAndHideSensitive, validateAppConfig } = require('./configuration/app-config')
const { fetchCertsFromS3 } = require('./scripts/download-certs')
const { buildApplication } = require('./setup/app')
const { setupExpressApp, createWebServer, reloadTrustedCerts } = require('./setup/server')
const logger = require('./logging/logger-builder')(__filename)

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

async function run () {
  try {
    logger.debug('Going to try reload trusted certificates.')
    reloadTrustedCerts(logger)

    const appConfigLoaded = buildAppConfigFromEnvVariables()
    logger.info(`Loaded application config: ${stringifyAndHideSensitive(appConfigLoaded)}`)

    logger.debug('Going to fetch certificates/keys to serve.')
    await fetchCertsFromS3(appConfigLoaded)

    const appConfig = await validateAppConfig(appConfigLoaded)

    logger.info(`Effective application config: ${stringifyAndHideSensitive(appConfig)}`)
    await validateFinalConfig(appConfig)

    logger.debug('Going to build application internals.')
    const application = await buildApplication(appConfig)

    const expressApp = express()
    expressApp.set('app-name', 'agency')

    logger.debug('Going to build http/https server.')
    const enableTls = appConfig.SERVER_ENABLE_TLS === 'true'
    const tlsCertPath = appConfig.CERTIFICATE_PATH
    const tlsKeyPath = appConfig.CERTIFICATE_KEY_PATH
    const httpServer = createWebServer(expressApp, enableTls, tlsCertPath, tlsKeyPath, logger)

    await setupExpressApp(expressApp, application, appConfig)

    const port = appConfig.SERVER_PORT
    logger.debug(`Going to listen on port ${port}`)
    httpServer.listen(port, () => logger.info(`------------ Listening on port ${port} ------------`))
  } catch (err) {
    logger.error(`Unhandled error. Application will be terminated. ${err.stack}`)
    process.exit(255)
  }
}

run()
