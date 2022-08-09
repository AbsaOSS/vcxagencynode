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
const { loadEnvVariables } = require('./app-config-loader')

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

function _getLoggingValidationRules () {
  return {
    LOG_LEVEL: Joi.string().valid('trace', 'debug', 'info', 'warn', 'error').default('info'),
    LOG_JSON_TO_CONSOLE: Joi.boolean().default(true),
    LOG_ENABLE_INDYSDK: Joi.boolean().default(false),
    DISABLE_COLOR_LOGS: Joi.boolean().default(false),
    LOG_HEALTH_REQUESTS: Joi.boolean().default(false),
    EXPLAIN_QUERIES: Joi.boolean().default(false),
    DANGEROUS_HTTP_DETAILS: Joi.boolean().default(false),
    ECS_CONTAINER_METADATA_URI_V4: Joi.string().uri()
  }
}

function _mysqlValidationRules () {
  return {
    MYSQL_HOST: Joi.string().required(),
    MYSQL_PORT: Joi.number().integer().min(1025).max(65535).default(3306).required(),
    MYSQL_ACCOUNT: Joi.string().required(),
    MYSQL_PASSWORD_SECRET: Joi.string().required(),
    MYSQL_DATABASE_APPLICATION: Joi.string().required(),
    MYSQL_DATABASE_WALLET: Joi.string().required(),
    MYSQL_DATABASE_WALLET_CONNECTION_LIMIT: Joi.number().integer().min(1).max(100).default(50)
  }
}

function _getTlsValidationRules () {
  return {
    SERVER_ENABLE_TLS: Joi.boolean().default(true),
    AWS_S3_BUCKET_CERT: Joi.string(),
    CERTIFICATE_PATH: Joi.string(),
    CERTIFICATE_KEY_PATH: Joi.string(),
    AWS_S3_PATH_CERT: Joi.string(),
    AWS_S3_PATH_CERT_KEY: Joi.string()
  }
}

function _getServerValidationRules () {
  return {
    SERVER_PORT: Joi.number().integer().min(1025).max(65535).required(),
    SERVER_HOSTNAME: Joi.string().default('0.0.0.0'),
    SERVER_MAX_REQUEST_SIZE_KB: Joi.number().integer().min(1).max(MB_AS_KB * 10).default(512)
  }
}

function _setupWalletValidationRules () {
  return {
    AGENCY_SEED_SECRET: Joi.string().min(20).required()
  }
}

function _walletValidationRules () {
  return {
    AGENCY_WALLET_NAME: Joi.string().required(),
    AGENCY_WALLET_KEY_SECRET: Joi.string().min(20).required()
  }
}

function _applicationValidationRules () {
  return {
    REDIS_URL: Joi.string().uri(),
    REDIS_URL_NOTIFICATIONS: Joi.string().uri(),
    AGENCY_TYPE: Joi.string().valid('enterprise', 'client').required(),
    WEBHOOK_RESPONSE_TIMEOUT_MS: Joi.number().default(1000)
  }
}

function _extraValidationTls (appConfig) {
  if (appConfig.SERVER_ENABLE_TLS) {
    if (!appConfig.CERTIFICATE_PATH || !appConfig.CERTIFICATE_KEY_PATH) {
      throw new Error('Valid certificate and key paths must be specified when TLS enabled!')
    }
  }
}

function _extraValidationByAgencyType (appConfig) {
  if (appConfig.AGENCY_TYPE === 'client') {
    if (!appConfig.REDIS_URL) {
      throw new Error('Configuration for agency of type \'client\' must have REDIS_URL specified.')
    }
    if (!appConfig.REDIS_URL_NOTIFICATIONS) {
      throw new Error('Configuration for agency of type \'client\' must have REDIS_URL_NOTIFICATIONS specified.')
    }
  }
}

const OP_MODES = {
  RUN_SERVER: {
    name: 'run-server',
    postValidations: [_extraValidationTls, _extraValidationByAgencyType],
    joiValidationBody: {
      ..._getLoggingValidationRules(),
      ..._mysqlValidationRules(),
      ..._getTlsValidationRules(),
      ..._getServerValidationRules(),
      ..._setupWalletValidationRules(),
      ..._walletValidationRules(),
      ..._applicationValidationRules(),
      AGENCY_DID: Joi.string().required(),
      ECS_CONTAINER_METADATA_URI_V4: Joi.string().uri()
    }
  }
}

async function validateAppConfig (appConfig) {
  const operationModeInfo = OP_MODES.RUN_SERVER
  const { postValidations } = operationModeInfo
  const { value: effectiveConfig, error } = Joi.object().keys(operationModeInfo.joiValidationBody).validate(appConfig)
  if (error) {
    throw new Error(`Application configuration is not valid. Details ${stringifyAndHideSensitive(error)}`)
  }
  for (const postValidation of postValidations) {
    postValidation(effectiveConfig)
  }
  return effectiveConfig
}

async function loadConfiguration () {
  const envVariables = Object.keys(OP_MODES.RUN_SERVER.joiValidationBody)
  return loadEnvVariables(envVariables)
}

module.exports = {
  validateAppConfig,
  stringifyAndHideSensitive,
  loadConfiguration,
  OP_MODES
}
