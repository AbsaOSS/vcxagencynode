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
global.LOG_LEVEL = process.env.LOG_LEVEL || 'info'
global.LOG_JSON_TO_CONSOLE = process.env.LOG_JSON_TO_CONSOLE === 'true'
global.SILENT_WINSTON = process.env.SILENT_WINSTON === 'false'

/* eslint-env jest */
const uuid = require('uuid')
const { createDbSchemaApplication } = require('dbutils')
const { createDataStorage } = require('../../../src/service/storage/storage')

beforeAll(async () => {
  jest.setTimeout(1000 * 300)
})

let storage
beforeEach(async () => {
  const { info } = await createDbSchemaApplication()
  storage = await createDataStorage(info)
})

afterEach(async () => {
  storage.cleanUp()
})

describe('storage', () => {
  it('should set, update and get webhook for agent', async () => {
    const A = uuid.v4()
    const B = uuid.v4()

    await storage.setAgentWebhook(A, 'https://foooooo.org')
    await storage.setAgentWebhook(A, 'https://example.org')
    await storage.setAgentWebhook(B, 'http://localhost:9123')

    expect(await storage.getAgentWebhook(A)).toBe('https://example.org')
    expect(await storage.getAgentWebhook(B)).toBe('http://localhost:9123')
  })

  it('should return null if webhook was unset', async () => {
    const A = uuid.v4()

    await storage.setAgentWebhook(A, 'https://foooooo.org')
    await storage.setAgentWebhook(A, null)

    expect(await storage.getAgentWebhook(A)).toBe(null)
  })

  it('should return undefined if agent webhook record doesnt exist', async () => {
    const A = uuid.v4()

    expect(await storage.getAgentWebhook(A)).toBe(undefined)
  })

  it('should return null if no webhook value was set for agent', async () => {
    const A = uuid.v4()

    await storage.setAgentWebhook(A, null)

    expect(await storage.getAgentWebhook(A)).toBe(null)
  })
})
