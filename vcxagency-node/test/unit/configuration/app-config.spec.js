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

  MYSQL_HOST: 'localhost',
  MYSQL_PORT: 3306,
  MYSQL_ACCOUNT: 'root',
  MYSQL_PASSWORD_SECRET: 'mysecretpassword',
  MYSQL_DATABASE_APPLICATION: 'agency_application',
  MYSQL_DATABASE_WALLET: 'agency_wallets',
  MYSQL_DATABASE_WALLET_CONNECTION_LIMIT: 50
}

function getValidEnterpriseAgencyConfig () {
  return { ...BASE_CONFIG, AGENCY_TYPE: 'enterprise' }
}

function getValidClientAgencyConfig () {
  return {
    ...BASE_CONFIG,
    REDIS_URL: 'redis://localhost:6379/0',
    REDIS_URL_NOTIFICATIONS: 'redis://localhost:6379/1',
    AGENCY_TYPE: 'client'
  }
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

  it('should validate app config when MYSQL_HOST info is omitted', async () => {
    const appConfig = getValidClientAgencyConfig()
    delete appConfig.MYSQL_HOST
    await expect(validateAppConfig(appConfig))
      .rejects
      .toThrow(/.*\\"MYSQL_HOST\\" is required.*/)
  })

  it('should validate app config when MYSQL_PORT info is omitted', async () => {
    const appConfig = getValidClientAgencyConfig()
    delete appConfig.MYSQL_PORT
    await expect(validateAppConfig(appConfig))
      .rejects
      .toThrow(/.*\\"MYSQL_PORT\\" is required.*/)
  })

  it('should validate app config when MYSQL_ACCOUNT info is omitted', async () => {
    const appConfig = getValidClientAgencyConfig()
    delete appConfig.MYSQL_ACCOUNT
    await expect(validateAppConfig(appConfig))
      .rejects
      .toThrow(/.*\\"MYSQL_ACCOUNT\\" is required.*/)
  })

  it('should validate app config when MYSQL_PASSWORD_SECRET info is omitted', async () => {
    const appConfig = getValidClientAgencyConfig()
    delete appConfig.MYSQL_PASSWORD_SECRET
    await expect(validateAppConfig(appConfig))
      .rejects
      .toThrow(/.*\\"MYSQL_PASSWORD_SECRET\\" is required.*/)
  })

  it('should validate app config when MYSQL_DATABASE_APPLICATION info is omitted', async () => {
    const appConfig = getValidClientAgencyConfig()
    delete appConfig.MYSQL_DATABASE_APPLICATION
    await expect(validateAppConfig(appConfig))
      .rejects
      .toThrow(/.*\\"MYSQL_DATABASE_APPLICATION\\" is required.*/)
  })

  it('should validate app config when MYSQL_DATABASE_WALLET info is omitted', async () => {
    const appConfig = getValidClientAgencyConfig()
    delete appConfig.MYSQL_DATABASE_WALLET
    await expect(validateAppConfig(appConfig))
      .rejects
      .toThrow(/.*\\"MYSQL_DATABASE_WALLET\\" is required.*/)
  })

  it('should invalidate client agency config if REDIS_URL is omitted', async () => {
    const appConfig = getValidClientAgencyConfig()
    delete appConfig.REDIS_URL
    await expect(validateAppConfig(appConfig))
      .rejects
      .toThrow("Configuration for agency of type 'client' must have REDIS_URL specified.")
  })
})
