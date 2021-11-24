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
const { storedMessageToResponseFormat, buildStoredMessage } = require('../../../src/service/storage/storage-utils')

describe('message formats', () => {
  it('should should build stored message', async () => {
    const msg = buildStoredMessage('agentDid', 'aconnDid', 'uid', 'MS-103', { foo: 'bar' })
    expect(msg.metadata.uid).toBe('uid')
    expect(msg.metadata.agentConnectionDid).toBe('aconnDid')
    expect(msg.metadata.agentDid).toBe('agentDid')
    expect(msg.metadata.statusCode).toBe('MS-103')
    expect(JSON.stringify(msg.payload)).toBe(JSON.stringify({ foo: 'bar' }))
  })

  it('should convert stored message to response msg format', async () => {
    const msg = buildStoredMessage('agentDid', 'aconnDid', 'uid', 'MS-103', { foo: 'bar' })
    const responseMsg = storedMessageToResponseFormat(msg)
    expect(responseMsg.uid).toBe('uid')
    expect(responseMsg.type).toBe('aries')
    expect(responseMsg.statusCode).toBe('MS-103')
    expect(responseMsg.senderDID).toBe('')
    expect(JSON.stringify(responseMsg.payload)).toBe(JSON.stringify({ foo: 'bar' }))
  })
})
