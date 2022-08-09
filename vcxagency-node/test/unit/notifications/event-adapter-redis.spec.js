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
global.LOG_LEVEL = process.env.LOG_LEVEL || 'info'
global.LOG_JSON_TO_CONSOLE = process.env.LOG_JSON_TO_CONSOLE === 'true'
global.SILENT_WINSTON = process.env.SILENT_WINSTON === 'false'

const sleep = require('sleep-promise')
const uuid = require('uuid')
const { buildRedisAdapter } = require('../../../src/service/notifications/event-adapter-redis')

let agentDid

let redisAdapter1
let redisAdapter2

beforeEach(async () => {
  agentDid = uuid.v4()
  redisAdapter1 = buildRedisAdapter('redis://localhost:6379/0')
  redisAdapter2 = buildRedisAdapter('redis://localhost:6379/1')
  await sleep(100)
})

afterEach(async () => {
  redisAdapter1.cleanUp()
  redisAdapter2.cleanUp()
})

describe('redis event adapter', () => {
  it('should set and get value', async () => {
    const value1 = uuid.v4()
    const value2 = uuid.v4()
    await redisAdapter1.setValue(agentDid, value1)
    await redisAdapter2.setValue(agentDid, value2)
    const retrieved1 = await redisAdapter1.getValue(agentDid)
    const retrieved2 = await redisAdapter2.getValue(agentDid)
    expect(retrieved1).toBe(value1)
    expect(retrieved2).toBe(value2)
  })

  it('should delete value', async () => {
    const value = uuid.v4()
    await redisAdapter1.setValue(agentDid, value)
    await redisAdapter1.deleteValue(agentDid)
    const retrieved = await redisAdapter1.getValue(agentDid)
    expect(retrieved).toBeNull()
  })

  it('should try to get unknown key', async () => {
    const retrieved = await redisAdapter1.getValue(agentDid)
    expect(retrieved).toBeNull()
  })

  it('modified value should trigger event callback on matching modified key', async () => {
    await redisAdapter1.subscribeKey(agentDid)
    let callbackWasTriggered = false
    let modifiedKey
    redisAdapter1.registerModifiedKeyCallback(async function (key) {
      callbackWasTriggered = true
      modifiedKey = key
    })
    const value = uuid.v4()
    await redisAdapter1.setValue(agentDid, value)
    await sleep(20)
    const retrieved = await redisAdapter1.getValue(agentDid)
    expect(retrieved).toBe(value)
    expect(callbackWasTriggered).toBeTruthy()
    expect(modifiedKey).toBe(agentDid)
  })

  it('modified value should not trigger event callback if unsubscribe has been called', async () => {
    await redisAdapter1.subscribeKey(agentDid)
    let callbackWasTriggered = false
    redisAdapter1.registerModifiedKeyCallback(async function (_key) {
      callbackWasTriggered = true
    })
    await redisAdapter1.unsubscribeKey(agentDid)
    await redisAdapter1.setValue(agentDid, true)
    await sleep(20)
    expect(callbackWasTriggered).toBeFalsy()
  })

  it('should not trigger notification in different keyspace', async () => {
    await redisAdapter1.subscribeKey(agentDid)
    await redisAdapter2.subscribeKey(agentDid)
    let callbackWasTriggered1 = false
    redisAdapter1.registerModifiedKeyCallback(async function (_key) {
      callbackWasTriggered1 = true
    })
    let callbackWasTriggered2 = false
    redisAdapter2.registerModifiedKeyCallback(async function (_key) {
      callbackWasTriggered2 = true
    })
    const value1 = uuid.v4()
    await redisAdapter1.setValue(agentDid, value1)
    await sleep(50)

    expect(callbackWasTriggered1).toBeTruthy()
    expect(callbackWasTriggered2).toBeFalsy()
    expect(await redisAdapter1.getValue(agentDid)).toBe(value1)
    expect(await redisAdapter2.getValue(agentDid)).toBeNull()
    callbackWasTriggered1 = false
    callbackWasTriggered2 = false

    const value2 = uuid.v4()
    await redisAdapter2.setValue(agentDid, value2)
    await sleep(20)

    expect(callbackWasTriggered1).toBeFalsy()
    expect(callbackWasTriggered2).toBeTruthy()
    expect(await redisAdapter1.getValue(agentDid)).toBe(value1)
    expect(await redisAdapter2.getValue(agentDid)).toBe(value2)
  })
})
