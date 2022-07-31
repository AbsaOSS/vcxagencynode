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

const redis = require('redis')
const sleep = require('sleep-promise')
const uuid = require('uuid')
const { buildRedisAdaptor } = require('../../../src/service/notifications/event-adaptor-redis')

let agentDid
let redisClientSubscriber
let redisClientRw
let redisAdaptor

beforeEach(async () => {
  agentDid = uuid.v4()
  redisClientSubscriber = redis.createClient('redis://localhost:6379/0')
  redisClientRw = redis.createClient('redis://localhost:6379/0')

  redisClientRw.on('error', function (err) {
    console.log(`Redis rw client encountered error: ${err}`)
  })
  redisClientRw.on('error', function (err) {
    console.log(`Redis subscription client encountered error: ${err}`)
  })

  redisAdaptor = buildRedisAdaptor(redisClientSubscriber, redisClientRw)
  await sleep(100)
})

afterEach(async () => {
  redisAdaptor.cleanupResources()
})

describe('redis event adaptor', () => {
  it('should set and get value', async () => {
    const value = uuid.v4()
    await redisAdaptor.setValue(agentDid, value)
    const retrieved = await redisAdaptor.getValue(agentDid)
    expect(retrieved).toBe(value)
  })

  it('should delete value', async () => {
    const value = uuid.v4()
    await redisAdaptor.setValue(agentDid, value)
    await redisAdaptor.deleteValue(agentDid)
    const retrieved = await redisAdaptor.getValue(agentDid)
    expect(retrieved).toBeNull()
  })

  it('should try to get unknown key', async () => {
    const retrieved = await redisAdaptor.getValue(agentDid)
    expect(retrieved).toBeNull()
  })

  it('modified value should trigger event callback on matching modified key', async () => {
    await redisAdaptor.subscribeKey(agentDid)
    let callbackWasTriggered = false
    let modifiedKey
    redisAdaptor.registerModifiedKeyCallback(async function (key) {
      callbackWasTriggered = true
      modifiedKey = key
    })
    const value = uuid.v4()
    await redisAdaptor.setValue(agentDid, value)
    await sleep(20)
    const retrieved = await redisAdaptor.getValue(agentDid)
    expect(retrieved).toBe(value)
    expect(callbackWasTriggered).toBeTruthy()
    expect(modifiedKey).toBe(agentDid)
  })

  it('modified value should not trigger event callback if unsubscribe has been called', async () => {
    await redisAdaptor.subscribeKey(agentDid)
    let callbackWasTriggered = false
    redisAdaptor.registerModifiedKeyCallback(async function (_key) {
      callbackWasTriggered = true
    })
    await redisAdaptor.unsubscribeKey(agentDid)
    await redisAdaptor.setValue(agentDid, true)
    await sleep(20)
    expect(callbackWasTriggered).toBeFalsy()
  })
})
