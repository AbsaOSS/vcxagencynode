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

/*
** No logger section **
*
* In following section we do not use, or import a file which does, winston logger builder.
* Logger builder depends on app configuration loaded first, and that's what we do bellow.
*/
const { stringifyAndHideSensitive, loadConfiguration, validateAppConfig } = require('./configuration/app-config')
const fs = require('fs')
const https = require('https')

function setLoggingGlobalSettings (appConfig) {
  global.DISABLE_COLOR_LOGS = appConfig.DISABLE_COLOR_LOGS
  global.LOG_JSON_TO_CONSOLE = appConfig.LOG_JSON_TO_CONSOLE
  global.LOG_LEVEL = appConfig.LOG_LEVEL
  global.EXPLAIN_QUERIES = appConfig.EXPLAIN_QUERIES
}

async function setGlobalVariables (appConfig) {
  setLoggingGlobalSettings(appConfig)
  global.WEBHOOK_RESPONSE_TIMEOUT_MS = appConfig.WEBHOOK_RESPONSE_TIMEOUT_MS
  const { fetchEcsTaskMetadata } = require('./scripts/fetch-ecs-task-metadata')
  global.ecsTaskMetadata = await fetchEcsTaskMetadata(appConfig.ECS_CONTAINER_METADATA_URI_V4)
}

async function run () {
  const envConfig = await loadConfiguration()
  const appConfig = await validateAppConfig(envConfig)
  await setGlobalVariables(appConfig)
  // only after global variables are set we can import files which work with logger
  const logger = require('./logging/logger-builder')(__filename)
  logger.info(`Starting up with effective config: ${stringifyAndHideSensitive(appConfig)}`)

  const { startServer } = require('./execution/run')

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

  function reloadTrustedCerts () {
    const TRUSTED_CA_CERTS_PATH = '/etc/ssl/certs/ca-certificates.crt'
    if (fs.existsSync(TRUSTED_CA_CERTS_PATH)) {
      https.globalAgent.options.ca = fs.readFileSync(TRUSTED_CA_CERTS_PATH)
      logger.warn(`Loaded additional trusted CA certificates from ${TRUSTED_CA_CERTS_PATH}`)
    } else {
      logger.warn('No additional trusted CA certificates were loaded.')
    }
  }
  reloadTrustedCerts()
  await startServer(appConfig)
  return false
}

run()
  .then((shouldExit) => {
    if (shouldExit) {
      process.exit(0)
    }
  })
  .catch(err => {
    console.error(`Unhandled error. Application will be terminated. ${err.stack}`)
    process.exit(255)
  })
