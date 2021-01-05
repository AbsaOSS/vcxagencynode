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

afterEach(async () => {
  storage.cleanUp()
})

describe('storage', () => {
  // todo: add test for failing status updates
  it('should store messages and update status codes for specific messages', async () => {
    const uid1 = uuid.v4()
    const uid2 = uuid.v4()
    const uid3 = uuid.v4()
    const uid4 = uuid.v4()
    const agentConn1Did = uuid.v4()
    const agentConn2Did = uuid.v4()
    const agentDid = uuid.v4()

    // agent 1
    await storage.storeMessage(agentDid, agentConn1Did, uid1, 'MS-103', { msg: 'hello1' })
    // agent 2
    await storage.storeMessage(agentDid, agentConn2Did, uid2, 'MS-104', { msg: 'hello2' })
    await storage.storeMessage(agentDid, agentConn2Did, uid3, 'MS-105', { msg: 'hello3' })
    await storage.storeMessage(agentDid, agentConn2Did, uid4, 'MS-105', { msg: 'hello4' })

    // act
    const { failed, updated } =
      await storage.updateStatusCodes(agentDid, [{ agentConnDid: agentConn2Did, uids: [uid2, uid4] }], 'MS-106')

    // assert
    expect(failed.length).toBe(0)
    expect(updated.length).toBe(1)
    expect(updated[0].agentConnDid).toBe(agentConn2Did)
    expect(updated[0].uids.length).toBe(2)
    expect(updated[0].uids.find(uid => uid === uid2)).toBeDefined()
    expect(updated[0].uids.find(uid => uid === uid4)).toBeDefined()

    const msgObjects = await storage.loadMessages(agentDid, agentConn2Did, [], [])
    expect(msgObjects.length).toBe(3)
    const msg2 = msgObjects.find(m => m.metadata.uid === uid2)
    const msg3 = msgObjects.find(m => m.metadata.uid === uid3)
    const msg4 = msgObjects.find(m => m.metadata.uid === uid4)
    expect(msg2.metadata.statusCode).toBe('MS-106')
    expect(msg3.metadata.statusCode).toBe('MS-105')
    expect(msg4.metadata.statusCode).toBe('MS-106')
  })

  it('should not update statuses if no uid specified', async () => {
    const uid1 = uuid.v4()
    const uid2 = uuid.v4()
    const uid3 = uuid.v4()
    const uid4 = uuid.v4()
    const agentConn1Did = uuid.v4()
    const agentConn2Did = uuid.v4()
    const agentDid = uuid.v4()

    // agent 1
    await storage.storeMessage(agentDid, agentConn1Did, uid1, 'MS-103', { msg: 'hello1' })

    // agent 2
    await storage.storeMessage(agentDid, agentConn2Did, uid2, 'MS-104', { msg: 'hello2' })
    await storage.storeMessage(agentDid, agentConn2Did, uid3, 'MS-105', { msg: 'hello3' })
    await storage.storeMessage(agentDid, agentConn2Did, uid4, 'MS-105', { msg: 'hello4' })

    // act
    const { failed, updated } =
      await storage.updateStatusCodes(agentDid, [{ agentConnDid: agentConn2Did, uids: [] }], 'MS-106')

    // assert
    expect(failed.length).toBe(0)
    expect(updated.length).toBe(0)
  })
})
