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
const { longpollNotificationsV2 } = require('../../../src/service/notifications/longpoll-v2')

let serviceNewMessagesV2
let agentDid

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

describe('longpoll', () => {
  it('should call new-message-callback if new message is flagged for agent', async () => {
    const responses = []
    const timeoutMs = 1000

    longpollNotificationsV2(serviceNewMessagesV2, agentDid, timeoutMs)
      .then((lastMsgUtime) => {
        responses.push(lastMsgUtime)
      })

    await sleep(10) // no callback should be call at this point
    expect(responses.length).toBe(0)

    const newMsgTimestamp = _now()
    await serviceNewMessagesV2.flagNewMessage(agentDid, newMsgTimestamp)

    await sleep(10) // new-message-callback should be called soon after new message flag is enabled
    expect(responses.length).toBe(1)
    expect(responses[0]).toBeGreaterThanOrEqual(newMsgTimestamp)
    expect(responses[0]).toBeLessThan(_now())

    await sleep(1500) // after timeout duration no callback should be called again
    expect(responses.length).toBe(1)
  })

  it('should call timeout-callback', async () => {
    const responses = []
    const timeoutMs = 1000

    longpollNotificationsV2(serviceNewMessagesV2, agentDid, timeoutMs)
      .then((lastMsgUtime) => {
        responses.push(lastMsgUtime)
      })

    await sleep(10) // no callback should be call at this point
    expect(responses.length).toBe(0)

    await sleep(1000) // after timeout duration no callback should be called again
    expect(responses.length).toBe(1)
    expect(responses[0]).toBeNull()
  })

  it('should call new-message-callback if new message is flagged before longpoll begins', async () => {
    const responses = []
    const timeoutMs = 1000

    const newMsgTimestamp = _now()
    await serviceNewMessagesV2.flagNewMessage(agentDid, newMsgTimestamp)
    await sleep(50)

    longpollNotificationsV2(serviceNewMessagesV2, agentDid, timeoutMs)
      .then((lastMsgUtime) => {
        responses.push(lastMsgUtime)
      })

    await sleep(10) // new-message-callback should be called soon after new message flag is enabled
    expect(responses.length).toBe(1)
    expect(responses[0]).toBeGreaterThanOrEqual(newMsgTimestamp)
    expect(responses[0]).toBeLessThan(_now())

    await sleep(1500) // after timeout duration no callback should be called again
    expect(responses.length).toBe(1)
  })
})
