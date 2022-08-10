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
const { createServiceNewMessages } = require('../../../src/service/notifications/service-new-messages')
const { longpollNotifications } = require('../../../src/service/notifications/longpoll')
const { buildRedisAdapter } = require('../../../src/service/notifications/event-adapter-redis')

let serviceNewMessagesV1
let agentDid

beforeEach(async () => {
  agentDid = uuid.v4()
  const redisAdapter = buildRedisAdapter('redis://localhost:6379/0')
  serviceNewMessagesV1 = createServiceNewMessages(redisAdapter)
  await sleep(100)
})

afterEach(async () => {
  await serviceNewMessagesV1.cleanUp()
})

describe('longpoll', () => {
  it('should call new-message-callback if new message is flagged for agent', async () => {
    let countNewMessage = 0
    let countTimeout = 0
    const timeoutMs = 1000

    longpollNotifications(serviceNewMessagesV1, agentDid, timeoutMs)
      .then((hasMessage) => {
        if (hasMessage) { countNewMessage += 1 } else { countTimeout += 1 }
      })

    await sleep(10) // no callback should be call at this point
    expect(countNewMessage).toBe(0)
    expect(countTimeout).toBe(0)

    await serviceNewMessagesV1.flagNewMessage(agentDid)

    await sleep(10) // new-message-callback should be called soon after new message flag is enabled
    expect(countNewMessage).toBe(1)
    expect(countTimeout).toBe(0)

    await sleep(1500) // after timeout duration no callback should be called again
    expect(countNewMessage).toBe(1)
    expect(countTimeout).toBe(0)
  })

  it('should call timeout-callback', async () => {
    let countNewMessage = 0
    let countTimeout = 0
    const timeoutMs = 1000

    longpollNotifications(serviceNewMessagesV1, agentDid, timeoutMs)
      .then((hasMessage) => {
        if (hasMessage) { countNewMessage += 1 } else { countTimeout += 1 }
      })

    await sleep(10) // no callback should be call at this point
    expect(countNewMessage).toBe(0)
    expect(countTimeout).toBe(0)

    await sleep(1000) // after timeout duration no callback should be called again
    expect(countNewMessage).toBe(0)
    expect(countTimeout).toBe(1)
  })

  it('should call new-message-callback if new message is flagged before longpoll begins', async () => {
    let countNewMessage = 0
    let countTimeout = 0
    const timeoutMs = 1000

    await serviceNewMessagesV1.flagNewMessage(agentDid)
    await sleep(50)

    longpollNotifications(serviceNewMessagesV1, agentDid, timeoutMs)
      .then((hasMessage) => {
        if (hasMessage) { countNewMessage += 1 } else { countTimeout += 1 }
      })
    await sleep(10)
    expect(countNewMessage).toBe(1)
    expect(countTimeout).toBe(0)

    await sleep(1000) // after timeout duration no callback should be called again
    expect(countNewMessage).toBe(1)
    expect(countTimeout).toBe(0)
  })
})
