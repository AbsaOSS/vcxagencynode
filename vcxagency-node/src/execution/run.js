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
const logger = require('./../logging/logger-builder')(__filename)
const { fetchServerCertsFromS3 } = require('../scripts/download-certs')
const { buildApplication } = require('./app')
const { createWebServer, setupExpressApp } = require('./server')

async function startServer (appConfig) {
  try {
    process.on('SIGTERM', signal => {
      logger.warn(`Process ${process.pid} [startServer execution mode] received a SIGTERM signal.`)
      process.exit(0)
    })

    process.on('SIGINT', signal => {
      logger.warn(`Process ${process.pid} [startServer execution mode] has been interrupted.`)
      process.exit(0)
    })

    if (appConfig.SERVER_ENABLE_TLS) {
      logger.info('Fetching certificates/keys to serve.')
      await fetchServerCertsFromS3(appConfig)
    }

    logger.debug('Going to build application internals.')
    const application = await buildApplication(appConfig)

    const expressApp = express()
    expressApp.set('app-name', 'agency')

    logger.debug('Going to build http/https server.')
    const httpServer = createWebServer(expressApp, appConfig.SERVER_ENABLE_TLS, appConfig.CERTIFICATE_PATH, appConfig.CERTIFICATE_KEY_PATH, logger)
    await setupExpressApp(expressApp, application, appConfig)

    logger.debug(`Going to listen on port ${appConfig.SERVER_PORT}`)
    httpServer.listen(appConfig.SERVER_PORT, () => logger.info(`------------ Listening on port ${appConfig.SERVER_PORT} ------------`))
  } catch (err) {
    logger.error(`Unhandled error. Application will be terminated. ${err.stack}`)
    process.exit(255)
  }
}

module.exports = {
  startServer
}
