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
const uuid = require('uuid')
const { createTestPgDb } = require('../../pg-tmpdb')
const { createPgStorageEntities } = require('../../../src/service/storage/pgstorage-entities')

beforeAll(async () => {
  jest.setTimeout(1000 * 300)
})

let storage
beforeEach(async () => {
  const { info } = await createTestPgDb()
  storage = await createPgStorageEntities(info)
})

describe('storage', () => {
  it('should set, update and get webhook for agent', async () => {
    const A = uuid.v4()
    const B = uuid.v4()

    // act
    await storage.setAgentWebhook(A, 'https://foooooo.org')
    await storage.setAgentWebhook(A, 'https://example.org')
    await storage.setAgentWebhook(B, 'http://localhost:9123')

    // assert
    expect(await storage.getAgentWebhook(A)).toBe('https://example.org')
    expect(await storage.getAgentWebhook(B)).toBe('http://localhost:9123')
  })
})
