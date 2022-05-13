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

function stringifyAndHideSensitive (appConfig) {
  function hideSecrets (key, value) {
    if (!value) {
      return value
    }
    if (key.match(/.*SECRET.*/i)) {
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
  LOG_LEVEL: Joi.string().valid('silly', 'debug', 'info', 'warn', 'error'),
  LOG_ENABLE_INDYSDK: Joi.boolean().default(false),
  LOG_JSON_TO_CONSOLE: Joi.boolean().default(true),
  LOG_HEALTH_REQUESTS: Joi.boolean().default(false),
  DEV_MODE: Joi.boolean().default(false),

  SERVER_HOSTNAME: Joi.string().default('0.0.0.0'),
  SERVER_PORT: Joi.number().integer().min(1025).max(65535).required(),
  SERVER_ENABLE_TLS: Joi.boolean().default(true),
  SERVER_MAX_REQUEST_SIZE_KB: Joi.number().integer().min(1).max(MB_AS_KB * 10).default(512),
  CERTIFICATE_PATH: Joi.string(),
  CERTIFICATE_KEY_PATH: Joi.string(),

  AGENCY_WALLET_NAME: Joi.string().required(),
  AGENCY_WALLET_KEY_SECRET: Joi.string().min(20).required(),
  AGENCY_SEED_SECRET: Joi.string().min(20).required(),
  AGENCY_DID: Joi.string().required(),

  REDIS_URL: Joi.string(),
  AGENCY_TYPE: Joi.string().valid('enterprise', 'client').required(),

  MYSQL_HOST: Joi.string().required(),
  MYSQL_PORT: Joi.number().integer().min(1025).max(65535).default(3306).required(),
  MYSQL_ACCOUNT: Joi.string().required(),
  MYSQL_PASSWORD_SECRET: Joi.string().required(),
  MYSQL_DATABASE_APPLICATION: Joi.string().required(),
  MYSQL_DATABASE_WALLET: Joi.string().required(),
  MYSQL_DATABASE_WALLET_CONNECTION_LIMIT: Joi.number().integer().min(1).max(100).default(50),

  AWS_S3_PATH_CERT: Joi.string(),
  AWS_S3_BUCKET_CERT: Joi.string(),
  AWS_S3_PATH_CERT_KEY: Joi.string(),

  ECS_CONTAINER_METADATA_URI_V4: Joi.string().uri(),
  WEBHOOK_RESPONSE_TIMEOUT_MS: Joi.number().default(1000),
  EXPLAIN_QUERIES: Joi.boolean().default(false)
})

function validateFinalConfig (appConfig) {
  if (appConfig.AGENCY_TYPE === 'client') {
    if (!appConfig.REDIS_URL) {
      throw new Error('Configuration for agency of type \'client\' must have REDIS_URL specified.')
    }
  }
  function validateTls () {
    if (appConfig.SERVER_ENABLE_TLS === true) {
      if (!appConfig.CERTIFICATE_PATH || !appConfig.CERTIFICATE_KEY_PATH) {
        throw new Error('Valid certificate and key paths must be specified when TLS enabled!')
      }
    }
  }
  validateTls()
}

async function validateAppConfig (appConfig) {
  const { value: effectiveConfig, error } = configValidation.validate(appConfig)
  if (error) {
    throw new Error(`Application configuration is not valid. Details ${stringifyAndHideSensitive(error)}`)
  }
  validateFinalConfig(effectiveConfig)
  return effectiveConfig
}

module.exports = {
  validateAppConfig,
  validateFinalConfig,
  stringifyAndHideSensitive
}
