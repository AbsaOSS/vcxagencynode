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
const { createServiceNewMessages } = require('../../../src/service/notifications/service-new-messages')
const uuid = require('uuid')

let serviceNewMessages
let agentDid = 'foobar-123'
let callbackId = 123
let redisClientSubscriber
let redisClientRw

beforeEach(async () => {
  agentDid = uuid.v4()
  callbackId = uuid.v4()
  redisClientSubscriber = redis.createClient('redis://localhost:6379/0')
  redisClientRw = redis.createClient('redis://localhost:6379/0')

  redisClientRw.on('error', function (err) {
    console.log(`Redis rw client encountered error: ${err}`)
  })
  redisClientRw.on('error', function (err) {
    console.log(`Redis subscription client encountered error: ${err}`)
  })
  await sleep(100)
  serviceNewMessages = createServiceNewMessages(redisClientSubscriber, redisClientRw)
})

afterEach(async () => {
  redisClientSubscriber.quit()
  redisClientRw.quit()
})

describe('notifications', () => {
  it('should receive callback when new-message flag is set in redis', async () => {
    let callbackCount = 0
    function onNewMessage () { callbackCount += 1 }
    await serviceNewMessages.registerCallback(agentDid, callbackId, onNewMessage)
    await serviceNewMessages.flagNewMessage(agentDid)
    await sleep(50)
    expect(callbackCount).toBe(1)
  })

  it('should callback multiple times if callback is not cleaned or acked', async () => {
    let callbackCount = 0
    function onNewMessage () { callbackCount += 1 }
    await serviceNewMessages.registerCallback(agentDid, callbackId, onNewMessage)
    await serviceNewMessages.flagNewMessage(agentDid)
    await serviceNewMessages.flagNewMessage(agentDid)
    await serviceNewMessages.flagNewMessage(agentDid)
    await sleep(50)
    expect(callbackCount).toBe(3)
  })

  it('should not receive callback if it was cleaned up', async () => {
    let callbackCount = 0
    function onNewMessage () { callbackCount += 1 }
    await serviceNewMessages.registerCallback(agentDid, callbackId, onNewMessage)
    await serviceNewMessages.cleanupCallback(agentDid, callbackId)
    await serviceNewMessages.flagNewMessage(agentDid)
    await sleep(50)
    expect(callbackCount).toBe(0)
  })

  it('should not callback on new message after message was picked up and no new callback is registered', async () => {
    let callbackCount = 0
    function onNewMessage () { callbackCount += 1 }
    await serviceNewMessages.registerCallback(agentDid, callbackId, onNewMessage)
    await serviceNewMessages.flagNewMessage(agentDid)
    await sleep(10)
    await serviceNewMessages.ackNewMessage(agentDid)
    await sleep(10)
    await serviceNewMessages.flagNewMessage(agentDid)
    await sleep(10)
    expect(callbackCount).toBe(1)
  })

  it('should not callback on new message after message was picked up and no new callback is registered', async () => {
    let callbackCount = 0
    function onNewMessage () { callbackCount += 1 }
    await serviceNewMessages.registerCallback(agentDid, callbackId, onNewMessage)
    await serviceNewMessages.flagNewMessage(agentDid)
    await sleep(10)
    await serviceNewMessages.ackNewMessage(agentDid)
    await sleep(10)
    await serviceNewMessages.flagNewMessage(agentDid)
    await sleep(10)
    expect(callbackCount).toBe(1)
  })

  it('should not have new messages if new-message-flag was not enabled', async () => {
    const hasMessages = await serviceNewMessages.hasNewMessage(agentDid)
    expect(hasMessages).toBeFalsy()
  })

  it('should have new messages if new-message-flag was enabled', async () => {
    await serviceNewMessages.flagNewMessage(agentDid)
    const hasMessages = await serviceNewMessages.hasNewMessage(agentDid)
    expect(hasMessages).toBeTruthy()
  })

  it('should not have new messages after new message was acked', async () => {
    await serviceNewMessages.flagNewMessage(agentDid)
    await sleep(10)
    await serviceNewMessages.ackNewMessage(agentDid)
    await sleep(10)
    const hasMessages = await serviceNewMessages.hasNewMessage(agentDid)
    expect(hasMessages).toBeFalsy()
  })
})
