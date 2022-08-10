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
global.SILENT_WINSTON = process.env.SILENT_WINSTON === 'true'

const sleep = require('sleep-promise')
const { createServiceNewMessages } = require('../../../src/service/notifications/service-new-messages')
const uuid = require('uuid')
const { buildRedisAdapter } = require('../../../src/service/notifications/event-adapter-redis')

let serviceNewMessagesV1
let agentDid = 'foobar-123'
const callbackId = 123

beforeEach(async () => {
  agentDid = uuid.v4()
  const redisAdapter = buildRedisAdapter('redis://localhost:6379/0')
  serviceNewMessagesV1 = createServiceNewMessages(redisAdapter)
  await sleep(100)
})

afterEach(async () => {
  await serviceNewMessagesV1.cleanUp()
})

describe('notifications', () => {
  it('should receive callback when new-message flag is set in redis', async () => {
    let callbackCount = 0
    function onNewMessage () { callbackCount += 1 }
    await serviceNewMessagesV1.registerNewMessageCallback(agentDid, callbackId, onNewMessage)
    await serviceNewMessagesV1.flagNewMessage(agentDid)
    await sleep(50)
    expect(callbackCount).toBe(1)
  })

  it('should callback multiple times if callback is not cleaned or acked', async () => {
    let callbackCount = 0
    function onNewMessage () { callbackCount += 1 }
    await serviceNewMessagesV1.registerNewMessageCallback(agentDid, callbackId, onNewMessage)
    await serviceNewMessagesV1.flagNewMessage(agentDid)
    await serviceNewMessagesV1.flagNewMessage(agentDid)
    await serviceNewMessagesV1.flagNewMessage(agentDid)
    await sleep(50)
    expect(callbackCount).toBe(3)
  })

  it('should not receive callback if it was cleaned up', async () => {
    let callbackCount = 0
    function onNewMessage () { callbackCount += 1 }
    await serviceNewMessagesV1.registerNewMessageCallback(agentDid, callbackId, onNewMessage)
    await serviceNewMessagesV1.cleanupNewMessageCallback(agentDid, callbackId)
    await serviceNewMessagesV1.flagNewMessage(agentDid)
    await sleep(50)
    expect(callbackCount).toBe(0)
  })

  it('should not callback on new message after message was picked up and no new callback is registered', async () => {
    let callbackCount = 0
    function onNewMessage () { callbackCount += 1 }
    await serviceNewMessagesV1.registerNewMessageCallback(agentDid, callbackId, onNewMessage)
    await serviceNewMessagesV1.flagNewMessage(agentDid)
    await sleep(10)
    await serviceNewMessagesV1.ackNewMessage(agentDid)
    await sleep(10)
    await serviceNewMessagesV1.flagNewMessage(agentDid)
    await sleep(10)
    expect(callbackCount).toBe(1)
  })

  it('should not have new messages if new-message-flag was not set', async () => {
    const hasMessages = await serviceNewMessagesV1.hasUnackedMessage(agentDid)
    expect(hasMessages).toBeFalsy()
  })

  it('should have new messages if new-message-flag was enabled', async () => {
    await serviceNewMessagesV1.flagNewMessage(agentDid)
    const hasMessages = await serviceNewMessagesV1.hasUnackedMessage(agentDid)
    expect(hasMessages).toBeTruthy()
  })

  it('should not have new messages after new message was acked', async () => {
    await serviceNewMessagesV1.flagNewMessage(agentDid)
    await sleep(10)
    await serviceNewMessagesV1.ackNewMessage(agentDid)
    await sleep(10)
    const hasMessages = await serviceNewMessagesV1.hasUnackedMessage(agentDid)
    expect(hasMessages).toBeFalsy()
  })
})
