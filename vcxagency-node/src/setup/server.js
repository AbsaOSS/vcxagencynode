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
const httpContext = require('express-http-context')
const bodyParser = require('body-parser')
const { createExpressWinstonLogger } = require('../logging/express-logger-builder')
const logger = require('../logging/logger-builder')(__filename)
const https = require('https')
const fs = require('fs')
const apiAgency = require('../api/api-agency')
const apiMessaging = require('../api/api-messaging')
const apiHealth = require('../api/api-health')
const {
  logRequestsWithBody,
  logResponsesWithBody,
  setReqId,
  finalExpressHandlers
} = require('../api/middleware')


function createWebServer (expressApp, enableTls, tlsCertPath, tlsKeyPath, logger) {
  if (enableTls) {
    logger.info(`Will start HTTP server with TLS enabled. Cert=${tlsCertPath} Key=${tlsKeyPath}`)
    const optionsTls = {
      cert: fs.readFileSync(tlsCertPath),
      key: fs.readFileSync(tlsKeyPath)
    }
    return https.createServer(optionsTls, expressApp)
  } else {
    logger.warn('Will start HTTP server with TLS disabled.')
    return http.createServer(expressApp)
  }
}

function reloadTrustedCerts (logger) {
  const TRUSTED_CA_CERTS_PATH = '/etc/ssl/certs/ca-certificates.crt'
  if (fs.existsSync(TRUSTED_CA_CERTS_PATH)) {
    https.globalAgent.options.ca = fs.readFileSync(TRUSTED_CA_CERTS_PATH)
    logger.warn(`Loaded additional trusted CA certificates from ${TRUSTED_CA_CERTS_PATH}`)
  } else {
    logger.warn('No additional trusted CA certificates were loaded.')
  }
}

async function setupExpressApp (expressApp, application, appConfig) {
  logger.info('Setting up express endpoints and middleware.')
  const loggingExcludedRoutes = ['/api/health']
  const expressWinstonLogger = createExpressWinstonLogger(loggingExcludedRoutes)
  expressApp.use(expressWinstonLogger)

  if (appConfig.DANGEROUS_HTTP_DETAILS === 'true') {
    logger.warn('** DANGEROUS, FULL HTTP REQUESTS WILL BE LOGGED **')
    expressApp.use(logRequestsWithBody)
    expressApp.use(logResponsesWithBody)
  }

  const healthRouter = express.Router()
  expressApp.use('/api/health', healthRouter)
  apiHealth(healthRouter)

  expressApp.use(httpContext.middleware)
  expressApp.use(setReqId)

  const appRouter = express.Router()
  expressApp.use('/', appRouter)

  logger.info('Setting up express endpoints.')
  const appAgentJson = express.Router()
  appAgentJson.use(bodyParser.json())
  apiAgency(appAgentJson, entityForwardAgent, serviceNewMessages)
  appAgent.use('/', appAgentJson)

  const appAgentMsg = express.Router()
  appAgentMsg.use(bodyParser.raw({
    inflate: true,
    limit: `${maxRequestSizeKb}kb`,
    type: '*/*'
  }))
  apiMessaging(appAgentMsg, entityForwardAgent)
  appAgent.use('/agency/msg', appAgentMsg)

  finalExpressHandlers(expressApp)
  logger.info('Express app endpoints and middleware has been configured.')
}

module.exports = {
  setupExpressApp,
  createWebServer,
  reloadTrustedCerts
}
