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

const Joi = require('joi')
const fs = require('fs')

function stringifyAndHideSensitive (appConfig) {
  function hideSecrets (key, value) {
    if (!value) {
      return value
    }
    if (key.match(/.*_SECRET/i)) {
      if (typeof value === 'string') {
        return value[0] + value.slice(1).replace(/.(?!$)/g, '*')
      } else {
        return '***************'
      }
    } else return value
  }
  return JSON.stringify(appConfig, hideSecrets, 2)
}

const MB_AS_KB = 1024

const configValidation = Joi.object().keys({
  LOG_LEVEL: Joi.string().valid(['silly', 'debug', 'info', 'warn', 'error']),
  LOG_ENABLE_INDYSDK: Joi.string().valid(['true', 'false']),
  LOG_JSON_TO_CONSOLE: Joi.string().valid(['true', 'false']),
  SERVER_PORT: Joi.number().integer().min(1025).max(65535).required(),
  SERVER_MAX_REQUEST_SIZE_KB: Joi.number().integer().min(1).max(MB_AS_KB * 10).required(),
  SERVER_ENABLE_TLS: Joi.string().valid(['true', 'false']),
  CERTIFICATE_PATH: Joi.string().allow(''),
  CERTIFICATE_KEY_PATH: Joi.string().allow(''),
  CERTIFICATE_AUTHORITY_PATH: Joi.string().allow(''),

  AGENCY_WALLET_NAME: Joi.string().required(),
  AGENCY_DID: Joi.string().required(),
  AGENCY_SEED_SECRET: Joi.string().min(20).required(),
  AGENCY_WALLET_KEY_SECRET: Joi.string().min(20).required(),

  REDIS_URL: Joi.string().allow(''),
  AGENCY_TYPE: Joi.string().valid(['enterprise', 'client']).required(),

  PG_STORE_HOST: Joi.string().required(),
  PG_STORE_PORT: Joi.number().integer().min(1025).max(65535).required(),
  PG_STORE_ACCOUNT: Joi.string().required(),
  PG_STORE_PASSWORD_SECRET: Joi.string().required(),
  PG_STORE_DATABASE: Joi.string().required(),

  PG_WALLET_ACCOUNT: Joi.string().required(),
  PG_WALLET_PASSWORD_SECRET: Joi.string().required(),
  PG_WALLET_ADMIN_ACCOUNT: Joi.string(),
  PG_WALLET_ADMIN_PASSWORD_SECRET: Joi.string(),

  PG_WALLET_URL: Joi.string().required(),
  PG_WALLET_MAX_CONNECTIONS: Joi.number().integer().min(50).max(999),
  PG_WALLET_MIN_IDLE_COUNT: Joi.number().integer().min(0).max(0), // max 1 enforced on plugin level for MultiWalletSingleTableSharedPool strategy
  PG_WALLET_CONNECTION_TIMEOUT_MINS: Joi.number().integer().min(1).max(100)
})

async function validateAppConfig (appConfig) {
  return new Promise((resolve, reject) => {
    function testConfigPathExist (appConfig, key) {
      const path = appConfig[key]
      if (!fs.existsSync(path)) {
        reject(new Error(`${key} = ${path} is not a valid path or the path does not exist`))
      }
    }

    const joiCallback = function (err) {
      if (err) {
        reject(err)
      } else {
        if (appConfig.AGENCY_TYPE === 'client') {
          if (!appConfig.REDIS_URL) {
            reject(new Error("Configuration for agency of type 'client' must have REDIS_URL specified."))
          }
        }
        if (appConfig.SERVER_ENABLE_TLS === 'true') {
          if (!appConfig.CERTIFICATE_PATH || !appConfig.CERTIFICATE_KEY_PATH) {
            reject(new Error('Valid certificate and key paths must be specified when TLS enabled!'))
          }
          testConfigPathExist(appConfig, 'CERTIFICATE_PATH')
          testConfigPathExist(appConfig, 'CERTIFICATE_KEY_PATH')
          if (appConfig.CERTIFICATE_AUTHORITY_PATH) {
            testConfigPathExist(appConfig, 'CERTIFICATE_AUTHORITY_PATH')
          }
        }
        resolve()
      }
    }

    Joi.validate(appConfig, configValidation, joiCallback)
  })
}

module.exports = {
  validateAppConfig,
  stringifyAndHideSensitive
}
