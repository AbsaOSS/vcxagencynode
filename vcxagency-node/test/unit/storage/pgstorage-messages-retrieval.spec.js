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
const { createDataStorage } = require('../../../src/service/storage/storage')
const { createDbSchemaApplication } = require('dbutils')

beforeAll(async () => {
  jest.setTimeout(1000 * 300)
})

let storage
beforeEach(async () => {
  const { info } = await createDbSchemaApplication()
  storage = await createDataStorage(info)
})

afterEach(async () => {
  storage.cleanUp()
})

describe('storage', () => {
  it('should store and retrieve messages of all agent connections', async () => {
    const uid1 = uuid.v4()
    const uid2 = uuid.v4()
    const uid3 = uuid.v4()
    const uid4 = uuid.v4()
    const uid5 = uuid.v4()
    const uid6 = uuid.v4()
    const a1Conn1Did = uuid.v4()
    const a1Conn2Did = uuid.v4()
    const a2Conn1Did = uuid.v4()
    const agentDid = uuid.v4()
    const agentDid2 = uuid.v4()

    // act
    await storage.storeMessage(agentDid, a1Conn1Did, uid1, 'MS-103', { msg: 'a1hello1' })
    await storage.storeMessage(agentDid, a1Conn2Did, uid2, 'MS-104', { msg: 'a1hello2' })
    await storage.storeMessage(agentDid, a1Conn2Did, uid3, 'MS-105', { msg: 'a1hello3' })

    await storage.storeMessage(agentDid2, a2Conn1Did, uid4, 'MS-103', { msg: 'a2hello1' })
    await storage.storeMessage(agentDid2, a2Conn1Did, uid5, 'MS-104', { msg: 'a2hello2' })
    await storage.storeMessage(agentDid2, a2Conn1Did, uid6, 'MS-105', { msg: 'a2hello3' })

    // assert
    const agent2Msgs = await storage.loadMessages(agentDid2, [], [], [])
    expect(agent2Msgs.length).toBe(3)
    const msg1 = agent2Msgs.find(m => m.metadata.uid === uid4)
    expect(msg1.metadata.statusCode).toBe('MS-103')
    expect(msg1.payload.msg).toBe('a2hello1')

    const msg2 = agent2Msgs.find(m => m.metadata.uid === uid5)
    expect(msg2.metadata.statusCode).toBe('MS-104')
    expect(msg2.payload.msg).toBe('a2hello2')

    const msg3 = agent2Msgs.find(m => m.metadata.uid === uid6)
    expect(msg3.metadata.statusCode).toBe('MS-105')
    expect(msg3.payload.msg).toBe('a2hello3')
  })

  it('should store and retrieve messages, retrieve msgs filtered by AconnDid', async () => {
    const uid1 = uuid.v4()
    const uid2 = uuid.v4()
    const uid3 = uuid.v4()
    const uid4 = uuid.v4()
    const uid5 = uuid.v4()
    const uid6 = uuid.v4()
    const uid7 = uuid.v4()
    const a1Conn1Did = uuid.v4()
    const a1Conn2Did = uuid.v4()
    const a2Conn1Did = uuid.v4()
    const a1Conn3Did = uuid.v4()
    const agentDid = uuid.v4()
    const agentDid2 = uuid.v4()

    // act
    await storage.storeMessage(agentDid, a1Conn1Did, uid1, 'MS-103', { msg: 'a1hello1' })
    await storage.storeMessage(agentDid, a1Conn2Did, uid2, 'MS-104', { msg: 'a1hello2' })
    await storage.storeMessage(agentDid, a1Conn2Did, uid3, 'MS-105', { msg: 'a1hello3' })
    await storage.storeMessage(agentDid, a1Conn3Did, uid4, 'MS-105', { msg: 'a1hello4' })

    await storage.storeMessage(agentDid2, a2Conn1Did, uid5, 'MS-103', { msg: 'a2hello1' })
    await storage.storeMessage(agentDid2, a2Conn1Did, uid6, 'MS-104', { msg: 'a2hello2' })
    await storage.storeMessage(agentDid2, a2Conn1Did, uid7, 'MS-105', { msg: 'a2hello3' })

    // assert
    const msgObjects = await storage.loadMessages(agentDid, [a1Conn1Did, a1Conn3Did], [], [])
    expect(msgObjects.length).toBe(2)
    expect(msgObjects.find(m => m.metadata.uid === uid1)).toBeDefined()
    expect(msgObjects.find(m => m.metadata.uid === uid4)).toBeDefined()
  })

  it('should store messages and filter by uids', async () => {
    const uid1 = uuid.v4()
    const uid2 = uuid.v4()
    const uid3 = uuid.v4()
    const uid4 = uuid.v4()
    const uid5 = uuid.v4()
    const uid6 = uuid.v4()
    const a1Conn1Did = uuid.v4()
    const a2Conn1Did = uuid.v4()
    const agentDid = uuid.v4()
    const agentDid2 = uuid.v4()

    // act
    await storage.storeMessage(agentDid, a1Conn1Did, uid1, 'MS-103', { msg: 'msg1' })
    await storage.storeMessage(agentDid, a1Conn1Did, uid2, 'MS-104', { msg: 'msg2' })
    await storage.storeMessage(agentDid, a1Conn1Did, uid3, 'MS-105', { msg: 'msg3' })

    await storage.storeMessage(agentDid2, a2Conn1Did, uid4, 'MS-103', { msg: 'xxxxxxx1' })
    await storage.storeMessage(agentDid2, a2Conn1Did, uid5, 'MS-104', { msg: 'xxxxxxx2' })
    await storage.storeMessage(agentDid2, a2Conn1Did, uid6, 'MS-105', { msg: 'xxxxxxx3' })

    // assert
    const msgObjects = await storage.loadMessages(agentDid, [], [uid1, uid3], [])
    expect(msgObjects.length).toBe(2)
    const storedMsg1 = msgObjects.find(m => m.metadata.uid === uid1)
    const storedMsg3 = msgObjects.find(m => m.metadata.uid === uid3)
    expect(storedMsg1.payload.msg).toBe('msg1')
    expect(storedMsg3.payload.msg).toBe('msg3')
  })

  it('should store messages and filter by status', async () => {
    const uid1 = uuid.v4()
    const uid2 = uuid.v4()
    const uid3 = uuid.v4()
    const uid4 = uuid.v4()
    const uid5 = uuid.v4()
    const uid6 = uuid.v4()
    const a1Conn1Did = uuid.v4()
    const a2Conn1Did = uuid.v4()
    const agentDid = uuid.v4()
    const agentDid2 = uuid.v4()

    // act
    await storage.storeMessage(agentDid, a1Conn1Did, uid1, 'MS-103', { msg: 'msg1' })
    await storage.storeMessage(agentDid, a1Conn1Did, uid2, 'MS-104', { msg: 'msg2' })
    await storage.storeMessage(agentDid, a1Conn1Did, uid3, 'MS-105', { msg: 'msg3' })

    await storage.storeMessage(agentDid2, a2Conn1Did, uid4, 'MS-103', { msg: 'xxxxxxx1' })
    await storage.storeMessage(agentDid2, a2Conn1Did, uid5, 'MS-104', { msg: 'xxxxxxx2' })
    await storage.storeMessage(agentDid2, a2Conn1Did, uid6, 'MS-105', { msg: 'xxxxxxx3' })

    // assert
    const msgObjects = await storage.loadMessages(agentDid, [], [], ['MS-105'])
    expect(msgObjects.length).toBe(1)
    expect(msgObjects.find(m => m.payload.msg === 'msg3')).toBeDefined()
  })

  it('should store messages and filter by agentConnection, uids and status', async () => {
    const uid1 = uuid.v4()
    const uid2 = uuid.v4()
    const uid3 = uuid.v4()
    const uid4 = uuid.v4()
    const uid5 = uuid.v4()
    const uid6 = uuid.v4()
    const uid7 = uuid.v4()
    const uid8 = uuid.v4()
    const uid9 = uuid.v4()
    const uid10 = uuid.v4()
    const uid11 = uuid.v4()
    const uid12 = uuid.v4()
    const uid13 = uuid.v4()
    const a1Conn1Did = uuid.v4()
    const a1Conn2Did = uuid.v4()
    const a2Conn1Did = uuid.v4()
    const agentDid = uuid.v4()
    const agentDid2 = uuid.v4()

    // act
    // agent1, conn1
    await storage.storeMessage(agentDid, a1Conn1Did, uid1, 'MS-103', { msg: 'msg1' })
    await storage.storeMessage(agentDid, a1Conn1Did, uid2, 'MS-103', { msg: 'msg2' })
    await storage.storeMessage(agentDid, a1Conn1Did, uid3, 'MS-104', { msg: 'msg3' })
    await storage.storeMessage(agentDid, a1Conn1Did, uid4, 'MS-104', { msg: 'msg3' })

    // agent1, conn2
    await storage.storeMessage(agentDid, a1Conn2Did, uid5, 'MS-104', { msg: 'msg4' })
    await storage.storeMessage(agentDid, a1Conn2Did, uid6, 'MS-104', { msg: 'msg5' })
    await storage.storeMessage(agentDid, a1Conn2Did, uid7, 'MS-105', { msg: 'msg6' })

    // agent2
    await storage.storeMessage(agentDid2, a2Conn1Did, uid8, 'MS-103', { msg: 'xxxxxxx1' })
    await storage.storeMessage(agentDid2, a2Conn1Did, uid9, 'MS-104', { msg: 'xxxxxxx2' })
    await storage.storeMessage(agentDid2, a2Conn1Did, uid10, 'MS-105', { msg: 'xxxxxxx3' })
    await storage.storeMessage(agentDid2, a2Conn1Did, uid11, 'MS-103', { msg: 'xxxxxxx1' })
    await storage.storeMessage(agentDid2, a2Conn1Did, uid12, 'MS-104', { msg: 'xxxxxxx2' })
    await storage.storeMessage(agentDid2, a2Conn1Did, uid13, 'MS-105', { msg: 'xxxxxxx3' })

    // assert
    const res1 = await storage.loadMessages(agentDid, [a1Conn1Did], [uid1], ['MS-103'])
    expect(res1.length).toBe(1)
    expect(res1.find(m => m.payload.msg === 'msg1')).toBeDefined()

    const res2 = await storage.loadMessages(agentDid, [a1Conn1Did, a1Conn2Did], [], ['MS-103', 'MS-105'])
    expect(res2.length).toBe(3)
    const res2msg1 = res2.find(m => m.metadata.uid === uid1)
    const res2msg2 = res2.find(m => m.metadata.uid === uid2)
    const res2msg7 = res2.find(m => m.metadata.uid === uid7)
    expect(res2msg1.payload.msg === 'msg1').toBeDefined()
    expect(res2msg2.payload.msg === 'msg2').toBeDefined()
    expect(res2msg7.payload.msg === 'msg7').toBeDefined()
  })
})
