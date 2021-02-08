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

const path = require('path')
const dotenv = require('dotenv')

const appConfigName = process.env.APP_CONFIG
if (appConfigName) {
  const pathToConfig = path.resolve(__dirname, `../../config/${appConfigName}.env`)
  console.log(`App configuration will be loaded from ${pathToConfig}.`)
  dotenv.config({ path: pathToConfig })
} else {
  console.log('App configuration will be loaded from supplied environment variables.')
}

function buildAppConfigFromEnvVariables () {
  const appConfig = {
    LOG_LEVEL: process.env.LOG_LEVEL || 'info',
    LOG_ENABLE_INDYSDK: process.env.LOG_ENABLE_INDYSDK || 'false',
    LOG_JSON_TO_CONSOLE: process.env.LOG_JSON_TO_CONSOLE,

    SERVER_PORT: process.env.SERVER_PORT,
    SERVER_MAX_REQUEST_SIZE_KB: process.env.SERVER_MAX_REQUEST_SIZE_KB || '300',
    SERVER_ENABLE_TLS: process.env.SERVER_ENABLE_TLS,
    CERTIFICATE_PATH: process.env.CERTIFICATE_PATH,
    CERTIFICATE_KEY_PATH: process.env.CERTIFICATE_KEY_PATH,

    AGENCY_WALLET_NAME: process.env.AGENCY_WALLET_NAME,
    AGENCY_DID: process.env.AGENCY_DID,
    AGENCY_SEED_SECRET: process.env.AGENCY_SEED_SECRET,
    AGENCY_WALLET_KEY_SECRET: process.env.AGENCY_WALLET_KEY_SECRET,

    REDIS_URL: process.env.REDIS_URL,
    AGENCY_TYPE: process.env.AGENCY_TYPE,

    PG_STORE_HOST: process.env.PG_STORE_HOST,
    PG_STORE_PORT: process.env.PG_STORE_PORT,
    PG_STORE_ACCOUNT: process.env.PG_STORE_ACCOUNT,
    PG_STORE_PASSWORD_SECRET: process.env.PG_STORE_PASSWORD_SECRET,
    PG_STORE_DATABASE: process.env.PG_STORE_DATABASE,

    PG_WALLET_ACCOUNT: process.env.PG_WALLET_ACCOUNT,
    PG_WALLET_PASSWORD_SECRET: process.env.PG_WALLET_PASSWORD_SECRET,
    PG_WALLET_ADMIN_ACCOUNT: process.env.PG_WALLET_ADMIN_ACCOUNT,
    PG_WALLET_ADMIN_PASSWORD_SECRET: process.env.PG_WALLET_ADMIN_PASSWORD_SECRET,

    PG_WALLET_URL: process.env.PG_WALLET_URL,
    PG_WALLET_MIN_IDLE_COUNT: process.env.PG_WALLET_MIN_IDLE_COUNT || '0',
    PG_WALLET_MAX_CONNECTIONS: process.env.PG_WALLET_MAX_CONNECTIONS || '90',
    PG_WALLET_CONNECTION_TIMEOUT_MINS: process.env.PG_WALLET_CONNECTION_TIMEOUT_MINS || '5',

    AWS_S3_PATH_CERT: process.env.AWS_S3_PATH_CERT,
    AWS_S3_BUCKET_CERT: process.env.AWS_S3_BUCKET_CERT,
    AWS_S3_PATH_CERT_KEY: process.env.AWS_S3_PATH_CERT_KEY
  }
  appConfig.SERVER_MAX_REQUEST_SIZE_KB = parseInt(appConfig.SERVER_MAX_REQUEST_SIZE_KB)
  appConfig.PG_WALLET_MIN_IDLE_COUNT = parseInt(appConfig.PG_WALLET_MIN_IDLE_COUNT)
  appConfig.PG_WALLET_MAX_CONNECTIONS = parseInt(appConfig.PG_WALLET_MAX_CONNECTIONS)
  appConfig.PG_WALLET_CONNECTION_TIMEOUT_MINS = parseInt(appConfig.PG_WALLET_CONNECTION_TIMEOUT_MINS)
  return appConfig
}

module.exports = { buildAppConfigFromEnvVariables }
