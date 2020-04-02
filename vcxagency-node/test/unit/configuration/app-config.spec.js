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

/* eslint-env jest */
const { stringifyAndHideSensitive } = require('../../../src/configuration/app-config')
const util = require('util')
const { validateAppConfig } = require('../../../src/configuration/app-config')

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

  it('should pass app config validation', async () => {
    const appConfig = {
      LOG_LEVEL: 'debug',
      LOG_ENABLE_INDYSDK: 'false',
      LOG_JSON_TO_CONSOLE: 'false',
      SERVER_PORT: '8080',
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
      PG_WALLET_MIN_IDLE_COUNT: '1',
      PG_WALLET_MAX_CONNECTIONS: '90',
      PG_WALLET_CONNECTION_TIMEOUT_MINS: '30'
    }
    const validationAsync = await util.promisify(validateAppConfig)
    await validationAsync(appConfig)
  })

  it('should validate app config when PG_WALLET_ADMIN_* info is omitted', async () => {
    const appConfig = {
      LOG_LEVEL: 'debug',
      LOG_ENABLE_INDYSDK: 'false',
      LOG_JSON_TO_CONSOLE: 'false',
      SERVER_PORT: '8080',
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

      PG_WALLET_URL: 'localhost:5432',
      PG_WALLET_MIN_IDLE_COUNT: '1',
      PG_WALLET_MAX_CONNECTIONS: '90',
      PG_WALLET_CONNECTION_TIMEOUT_MINS: '30'
    }
    const validationAsync = await util.promisify(validateAppConfig)
    await validationAsync(appConfig)
  })

  it('should invalidate app config when PG_WALLET_PASSWORD_SECRET is omitted', async () => {
    const appConfig = {
      LOG_LEVEL: 'debug',
      LOG_ENABLE_INDYSDK: 'false',
      LOG_JSON_TO_CONSOLE: 'false',
      SERVER_PORT: '8080',
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
      PG_WALLET_ADMIN_ACCOUNT: 'postgres',
      PG_WALLET_ADMIN_PASSWORD_SECRET: 'mysecretpassword',

      PG_WALLET_URL: 'localhost:5432',
      PG_WALLET_MIN_IDLE_COUNT: '1',
      PG_WALLET_MAX_CONNECTIONS: '90',
      PG_WALLET_CONNECTION_TIMEOUT_MINS: '30'
    }
    const validationAsync = await util.promisify(validateAppConfig)
    let thrown
    try {
      await validationAsync(appConfig)
    } catch (err) {
      thrown = err
    }
    expect(thrown).toBeDefined()
  })
})
