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

const fs = require('fs')
const https = require('https')
const http = require('http')
const express = require('express')
const httpContext = require('express-http-context')
const bodyParser = require('body-parser')
const { createExpressWinstonLogger } = require('../logging/express-logger-builder')
const logger = require('../logging/logger-builder')(__filename)
const apiAgency = require('../api/api-agency')
const apiMessaging = require('../api/api-messaging')
const apiHealth = require('../api/api-health')
const apiProxy = require('../api/api-proxy')
const {
  logRequestsWithBody,
  setReqId,
  finalExpressHandlers, buildDenyQueryStringsMiddleware
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

async function setupExpressApp (expressApp, application, appConfig) {
  const { entityForwardAgent, serviceNewMessagesV1, serviceNewMessagesV2 } = application
  logger.info('Setting up express endpoints and middleware.')
  expressApp.use(buildDenyQueryStringsMiddleware('timeout'))

  if (appConfig.DANGEROUS_HTTP_DETAILS === true) {
    logger.warn('** DANGEROUS, FULL HTTP REQUESTS WILL BE LOGGED **')
    expressApp.use(logRequestsWithBody)
  }

  let loggingExcludedRoutes = ['/', '/api/health']
  if (appConfig.LOG_HEALTH_REQUESTS === true) {
    logger.warn('Health requests will be logged.')
    loggingExcludedRoutes = []
  }
  const expressWinstonLogger = createExpressWinstonLogger(loggingExcludedRoutes)
  expressApp.use(expressWinstonLogger)

  const healthRouter = express.Router()
  expressApp.use(['/api/health', '/'], healthRouter)
  apiHealth(healthRouter)

  const maxRequestSizeKb = appConfig.SERVER_MAX_REQUEST_SIZE_KB
  if (appConfig.PROXY_TARGET_URL) {
    const proxyPrefixes = ['/api/proxy', '/didcomm']
    logger.info(`Requests to ${proxyPrefixes} will be forwarded to ${appConfig.PROXY_TARGET_URL}`)
    const routerProxy = express.Router()
    routerProxy.use(bodyParser.raw({
      inflate: false,
      limit: `${maxRequestSizeKb}kb`
    }))
    expressApp.use(proxyPrefixes, routerProxy)
    apiProxy(routerProxy, proxyPrefixes, appConfig.PROXY_TARGET_URL)
  }

  logger.info('Setting up express Aries API.')
  const expressAppAriesApi = express.Router()
  expressAppAriesApi.use(bodyParser.raw({
    inflate: true,
    limit: `${maxRequestSizeKb}kb`,
    type: '*/*'
  }))
  // it seems if httpContext.middleware / setReqId are before bodyParser.raw(), it's causing reqId getting deleted from httpContext
  expressAppAriesApi.use(httpContext.middleware)
  expressAppAriesApi.use(setReqId)
  apiMessaging(expressAppAriesApi, entityForwardAgent)
  expressApp.use('/agency/msg', expressAppAriesApi)

  logger.info('Setting up express JSON API.')
  const expressAppJsonApi = express.Router()
  expressAppJsonApi.use(httpContext.middleware)
  expressAppJsonApi.use(setReqId)
  expressAppJsonApi.use(bodyParser.json())
  apiAgency(expressAppJsonApi, entityForwardAgent, serviceNewMessagesV1, serviceNewMessagesV2)
  expressApp.use('/', expressAppJsonApi)

  finalExpressHandlers(expressApp)
  logger.info('Express app endpoints and middleware has been configured.')
}

module.exports = {
  setupExpressApp,
  createWebServer
}
