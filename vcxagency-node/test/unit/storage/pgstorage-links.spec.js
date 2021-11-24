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
const { createDbSchemaApplication } = require('dbutils')
const { createDataStorage } = require('../../../src/service/storage/storage')

const A1 = uuid.v4()
const A1Conn1 = uuid.v4()
const A1Conn1Pw = uuid.v4()
const A1Conn2 = uuid.v4()
const A1Conn2Pw = uuid.v4()
const A1Conn3 = uuid.v4()
const A1Conn3Pw = uuid.v4()

const A2 = uuid.v4()
const A2Conn1 = uuid.v4()
const A2Conn1Pw = uuid.v4()
const A2Conn2 = uuid.v4()
const A2Conn2Pw = uuid.v4()

let storage
describe('storage', () => {
  beforeAll(async () => {
    jest.setTimeout(1000 * 5)
    // arrange
    const { info } = await createDbSchemaApplication()
    storage = await createDataStorage(info)

    await storage.linkAgentToItsConnection(A1, A1Conn1, A1Conn1Pw)
    await storage.linkAgentToItsConnection(A1, A1Conn2, A1Conn2Pw)
    await storage.linkAgentToItsConnection(A1, A1Conn3, A1Conn3Pw)
    await storage.linkAgentToItsConnection(A2, A2Conn1, A2Conn1Pw)
    await storage.linkAgentToItsConnection(A2, A2Conn2, A2Conn2Pw)
  })

  afterAll(async () => {
    storage.cleanUp()
  })

  it('should link create Agent-AgentConnection links, then map UserPwDids to AgentConnDids', async () => {
    // assert
    const res1 = await storage.aconnLinkPairsByPwDids(A1, [A1Conn1Pw, A1Conn3Pw])
    expect(res1.length).toBe(2)
    expect(res1.find(link => link.agentConnDid === A1Conn1 && link.userPwDid === A1Conn1Pw)).toBeDefined()
    expect(res1.find(link => link.agentConnDid === A1Conn3 && link.userPwDid === A1Conn3Pw)).toBeDefined()

    const res2 = await storage.aconnLinkPairsByPwDids(A1, [A1Conn2Pw])
    expect(res2.length).toBe(1)
    expect(res2.find(link => link.agentConnDid === A1Conn2 && link.userPwDid === A1Conn2Pw)).toBeDefined()

    const res3 = await storage.aconnLinkPairsByPwDids(A2, [A1Conn2Pw])
    expect(res3.length).toBe(0)

    const res4 = await storage.aconnLinkPairsByPwDids(A1, ['12321321312312'])
    expect(res4.length).toBe(0)
  })

  it('should link create Agent-AgentConnection links, then map AgentConnDids to UserPwDids', async () => {
    // act
    const res1 = await storage.aconnLinkPairsByAconnDids(A1, [A1Conn1, A1Conn3])

    // assert
    expect(res1.length).toBe(2)
    expect(res1.find(link => link.agentConnDid === A1Conn1 && link.userPwDid === A1Conn1Pw)).toBeDefined()
    expect(res1.find(link => link.agentConnDid === A1Conn3 && link.userPwDid === A1Conn3Pw)).toBeDefined()

    const res2 = await storage.aconnLinkPairsByAconnDids(A1, [A1Conn2])
    expect(res2.length).toBe(1)
    expect(res2.find(link => link.agentConnDid === A1Conn2 && link.userPwDid === A1Conn2Pw)).toBeDefined()

    const res3 = await storage.aconnLinkPairsByAconnDids(A2, [A1Conn2])
    expect(res3.length).toBe(0)

    const res4 = await storage.aconnLinkPairsByAconnDids(A1, ['12321321312312'])
    expect(res4.length).toBe(0)
  })

  it('should convert uidsByAconnDids to uidsByPwDids', async () => {
    // arrange
    const uidsByAconnDids = [{ agentConnDid: A1Conn1, uids: ['foo'] }, { agentConnDid: A1Conn2, uids: ['bar'] }]

    // act
    const uidsByPwDids = await storage.convertIntoUserUpdateResponse(A1, uidsByAconnDids)

    // assert
    expect(uidsByPwDids.length).toBe(2)

    const r1 = uidsByPwDids.find(r => r.pairwiseDID === A1Conn1Pw)
    expect(r1).toBeDefined()
    expect(r1.uids.includes('foo')).toBeTruthy()

    const r2 = uidsByPwDids.find(r => r.pairwiseDID === A1Conn2Pw)
    expect(r2).toBeDefined()
    expect(r2.uids.includes('bar')).toBeTruthy()
  })

  it('should convert uidsByPwDids to uidsByAconnDids', async () => {
    // arrange
    const uidsByAconnDids = [{ pairwiseDID: A1Conn1Pw, uids: ['foo'] }, { pairwiseDID: A1Conn2Pw, uids: ['bar'] }]

    // act
    const uidsByPwDids = await storage.convertIntoStorageRequest(A1, uidsByAconnDids)

    // assert
    expect(uidsByPwDids.length).toBe(2)

    const r1 = uidsByPwDids.find(r => r.agentConnDid === A1Conn1)
    expect(r1).toBeDefined()
    expect(r1.uids.includes('foo')).toBeTruthy()

    const r2 = uidsByPwDids.find(r => r.agentConnDid === A1Conn2)
    expect(r2).toBeDefined()
    expect(r2.uids.includes('bar')).toBeTruthy()
  })
})
