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

const BASE_CONFIG = {
  LOG_LEVEL: 'debug',
  LOG_ENABLE_INDYSDK: 'false',
  LOG_JSON_TO_CONSOLE: 'false',
  SERVER_PORT: '8080',
  SERVER_ENABLE_TLS: 'false',
  SERVER_MAX_REQUEST_SIZE_KB: '300',

  AGENCY_WALLET_NAME: 'vcxagency-node',
  AGENCY_DID: 'VsKV7grR1BUE29mG2Fm2kX',
  AGENCY_SEED_SECRET: '0000000000000000000000000Forward',
  AGENCY_WALLET_KEY_SECRET: '01234567890123456789',

  PG_STORE_HOST: 'localhost',
  PG_STORE_PORT: '5432',
  PG_STORE_ACCOUNT: 'postgres',
  PG_STORE_PASSWORD_SECRET: 'mysecretpassword',
  PG_STORE_DATABASE: 'agency-storage',

  PG_WALLET_ACCOUNT: 'postgres',
  PG_WALLET_PASSWORD_SECRET: 'mysecretpassword',
  PG_WALLET_ADMIN_ACCOUNT: 'postgres',
  PG_WALLET_ADMIN_PASSWORD_SECRET: 'mysecretpassword',

  PG_WALLET_URL: 'localhost:5432',
  PG_WALLET_MAX_CONNECTIONS: '90',
  PG_WALLET_CONNECTION_TIMEOUT_MINS: '30'
}

function getValidEnterpriseAgencyConfig () {
  return { ...BASE_CONFIG, AGENCY_TYPE: 'enterprise' }
}

function getValidClientAgencyConfig () {
  return { ...BASE_CONFIG, REDIS_URL: 'redis://localhost:6379/0', AGENCY_TYPE: 'client' }
}

/* eslint-env jest */
const { stringifyAndHideSensitive } = require('../../../src/configuration/app-config')
const { validateAppConfig } = require('../../../src/configuration/app-config')
const path = require('path')

describe('app configuration', () => {
  it('should censor sensitive data in configuration', async () => {
    const appConfig = {
      FOO: 'foo',
      BAR_SECRET: 'secretdata'
    }
    const hidden = stringifyAndHideSensitive(appConfig)
    const hiddenParsed = JSON.parse(hidden)
    expect(hiddenParsed.FOO).toBe('foo')
    expect(hiddenParsed.BAR_SECRET).toBe('s********a')
  })

  it('if TLS enabled, throw error if certificate configs are not provided', async () => {
    const tlsConfig = {
      SERVER_ENABLE_TLS: 'true'
    }
    const config = { ...getValidEnterpriseAgencyConfig(), ...tlsConfig }
    await expect(validateAppConfig(config))
      .rejects
      .toThrow('Valid certificate and key paths must be specified when TLS enabled!')
  })

  it('if TLS enabled, allow empty cert key path for self-signed certificate', async () => {
    const tlsConfig = {
      SERVER_ENABLE_TLS: 'true',
      CERTIFICATE_PATH: path.join(__dirname, 'mock_certs', 'mock_cert.pem'),
      CERTIFICATE_KEY_PATH: path.join(__dirname, 'mock_certs', 'mock_key.pem')
    }
    await validateAppConfig({ ...getValidEnterpriseAgencyConfig(), ...tlsConfig })
  })

  it('should pass app config validation with AGENCY_TYPE enterprise', async () => {
    const appConfig = getValidEnterpriseAgencyConfig()
    await validateAppConfig(appConfig)
  })

  it('should pass app config validation with AGENCY_TYPE client', async () => {
    const appConfig = getValidClientAgencyConfig()
    await validateAppConfig(appConfig)
  })

  it('should validate app config when PG_WALLET_ADMIN_* info is omitted', async () => {
    const appConfig = getValidClientAgencyConfig()
    delete appConfig.PG_WALLET_ADMIN_ACCOUNT
    delete appConfig.PG_WALLET_ADMIN_PASSWORD_SECRET
    await validateAppConfig(appConfig)
  })

  it('should invalidate app config when PG_WALLET_PASSWORD_SECRET is omitted', async () => {
    const config = getValidEnterpriseAgencyConfig()
    delete config.PG_WALLET_PASSWORD_SECRET
    await expect(validateAppConfig(config))
      .rejects
      .toThrow('"PG_WALLET_PASSWORD_SECRET\\" is required')
  })

  it('should invalidate client agency config if REDIS_URL is omitted', async () => {
    const config = getValidClientAgencyConfig()
    delete config.REDIS_URL
    await expect(validateAppConfig(config))
      .rejects
      .toThrow("Configuration for agency of type 'client' must have REDIS_URL specified.")
  })
})
