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
const uuid = require('uuid')
const { buildRedisAdapter } = require('../../../src/service/notifications/event-adapter-redis')
const { createServiceNewMessagesV2 } = require('../../../src/service/notifications/service-new-messages-v2')

let serviceNewMessagesV2
let agentDid = 'foobar-123'
const callbackId = 123

beforeEach(async () => {
  agentDid = uuid.v4()
  const redisAdapter = buildRedisAdapter('redis://localhost:6379/1')
  serviceNewMessagesV2 = createServiceNewMessagesV2(redisAdapter)
  await sleep(100)
})

afterEach(async () => {
  await serviceNewMessagesV2.cleanUp()
})

function _now () {
  return Math.floor(+new Date())
}

describe('notifications', () => {
  it('should receive callback when new-message flag is set in redis', async () => {
    const utimes = []
    function onNewMessage (msgUtime) { utimes.push(msgUtime) }
    await serviceNewMessagesV2.registerCallback(agentDid, callbackId, onNewMessage)
    const newMsgTimestamp = _now()
    await serviceNewMessagesV2.flagNewMessage(agentDid, newMsgTimestamp)
    await sleep(50)
    expect(utimes.length).toBe(1)
    expect(utimes[0]).toBe(newMsgTimestamp)
  })

  it('should callback multiple times if callback is not cleaned or acked', async () => {
    const utimes = []
    function onNewMessage (msgUtime) { utimes.push(msgUtime) }
    await serviceNewMessagesV2.registerCallback(agentDid, callbackId, onNewMessage)
    await serviceNewMessagesV2.flagNewMessage(agentDid, _now())
    await serviceNewMessagesV2.flagNewMessage(agentDid, _now())
    await serviceNewMessagesV2.flagNewMessage(agentDid, _now())
    await sleep(50)
    expect(utimes.length).toBe(3)
  })

  it('should not receive callback if it was cleaned up', async () => {
    const utimes = []
    function onNewMessage (msgUtime) { utimes.push(msgUtime) }
    await serviceNewMessagesV2.registerCallback(agentDid, callbackId, onNewMessage)
    await serviceNewMessagesV2.cleanupCallback(agentDid, callbackId)
    await serviceNewMessagesV2.flagNewMessage(agentDid, _now())
    await sleep(50)
    expect(utimes.length).toBe(0)
  })

  it('should have no unacked messages if ack timestamp is precisely matching last message timestamp', async () => {
    const utimes = []
    function onNewMessage (msgUtime) { utimes.push(msgUtime) }
    await serviceNewMessagesV2.registerCallback(agentDid, callbackId, onNewMessage)

    const timestampMsg1 = _now()
    await serviceNewMessagesV2.flagNewMessage(agentDid, timestampMsg1)
    await sleep(10)
    await serviceNewMessagesV2.ackNewMessage(agentDid, timestampMsg1)
    await sleep(10)

    const hasMessages1 = await serviceNewMessagesV2.hasUnackedMessage(agentDid)
    expect(hasMessages1).toBeFalsy()
    expect(utimes.length).toBe(1)
  })

  it('should have no unacked messages if ack timestamp is bigger than last message timestamp', async () => {
    const utimes = []
    function onNewMessage (msgUtime) { utimes.push(msgUtime) }
    await serviceNewMessagesV2.registerCallback(agentDid, callbackId, onNewMessage)

    const timestampMsg1 = _now()
    await serviceNewMessagesV2.flagNewMessage(agentDid, timestampMsg1)
    await sleep(10)
    await serviceNewMessagesV2.ackNewMessage(agentDid, timestampMsg1 + 5)
    await sleep(10)

    const hasMessages1 = await serviceNewMessagesV2.hasUnackedMessage(agentDid)
    expect(hasMessages1).toBeFalsy()
    expect(utimes.length).toBe(1)
  })

  it('should have unacked messages if ack timestamp is smaller than last message timestamp', async () => {
    const timestampMsg1 = _now()
    await serviceNewMessagesV2.flagNewMessage(agentDid, timestampMsg1)

    await sleep(10)
    const timestampMsg2 = _now()
    await serviceNewMessagesV2.flagNewMessage(agentDid, timestampMsg2)

    await sleep(10)
    await serviceNewMessagesV2.ackNewMessage(agentDid, timestampMsg1)
    await sleep(10)

    const hasMessages1 = await serviceNewMessagesV2.hasUnackedMessage(agentDid)
    expect(hasMessages1).toBeTruthy()
  })

  it('should throw error if ack timestamp is bigger than present time timestamp', async () => {
    const timestampMsg1 = _now()
    await serviceNewMessagesV2.flagNewMessage(agentDid, timestampMsg1)
    await sleep(10)
    let thrown
    try {
      await serviceNewMessagesV2.ackNewMessage(agentDid, timestampMsg1 + 1000)
    } catch (err) {
      thrown = err
    }
    expect(thrown).toBeDefined()
  })

  it('should not callback on new message after message was picked up and no new callback is registered', async () => {
    const utimes = []
    function onNewMessage (msgUtime) { utimes.push(msgUtime) }
    await serviceNewMessagesV2.registerCallback(agentDid, callbackId, onNewMessage)

    const timestampMsg1 = _now()
    await serviceNewMessagesV2.flagNewMessage(agentDid, timestampMsg1)
    await sleep(10)
    await serviceNewMessagesV2.ackNewMessage(agentDid, timestampMsg1)
    await sleep(10)
    await serviceNewMessagesV2.flagNewMessage(agentDid, _now())
    await sleep(10)
    expect(utimes.length).toBe(1)
  })

  it('should not have new messages if new-message-flag was not set', async () => {
    const hasMessages = await serviceNewMessagesV2.hasUnackedMessage(agentDid)
    expect(hasMessages).toBeFalsy()
  })

  it('should have new messages if new-message-flag was enabled', async () => {
    const timestampMsg1 = _now()
    await serviceNewMessagesV2.flagNewMessage(agentDid, timestampMsg1)
    const hasMessages1 = await serviceNewMessagesV2.hasUnackedMessage(agentDid)
    expect(hasMessages1).toBeTruthy()
  })

  it('should not have new messages after new message was acked', async () => {
    const timestampMsg1 = _now()
    await serviceNewMessagesV2.flagNewMessage(agentDid, timestampMsg1)
    await sleep(10)
    await serviceNewMessagesV2.ackNewMessage(agentDid, timestampMsg1)
    await sleep(10)
    const hasMessages = await serviceNewMessagesV2.hasUnackedMessage(agentDid)
    expect(hasMessages).toBeFalsy()
  })
})
