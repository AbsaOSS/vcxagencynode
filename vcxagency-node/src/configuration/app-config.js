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

function _extraValidationTls (appConfig) {
  if (appConfig.SERVER_ENABLE_TLS) {
    if (!appConfig.CERTIFICATE_PATH || !appConfig.CERTIFICATE_KEY_PATH) {
      throw new Error('Valid certificate and key paths must be specified when TLS enabled!')
    }
  }
}

const OP_MODES = {
  RUN_SERVER: {
    name: 'run-server',
    postValidations: [_extraValidationTls],
    joiValidationBody: {
      ..._getLoggingValidationRules(),
      ..._getTlsValidationRules(),
      ..._getServerValidationRules(),
      ECS_CONTAINER_METADATA_URI_V4: Joi.string().uri(),
      PROXY_TARGET_URL: Joi.string().uri()
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
