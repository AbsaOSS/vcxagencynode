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
const {
  canConnectToDb,
  canConnectToDbSchema,
  dropMysqlDatabase,
  createMysqlDatabase,
  assureMysqlDatabase,
  migrateSchemaData,
  runSingleCmdOnSchema,
  migrateSchemaWallet,
  schemaExists
} = require('..')
const uuid = require('uuid')
const sleep = require('sleep-promise')

let testRunId

beforeAll(async () => {
  jest.setTimeout(1000 * 5)
})

beforeEach(async () => {
  testRunId = uuid.v4().split('-').join('')
})

afterEach(async () => {
  try {
    await dropMysqlDatabase(MYSQL_USER, MYSQL_PASSWORD, MYSQL_HOST, MYSQL_PORT, testRunId)
  } catch (err) {} finally {
    await sleep(100)
  }
})

const MYSQL_USER = process.env.MYSQL_USER || 'root'
const MYSQL_PASSWORD = process.env.MYSQL_PASSWORD || 'mysecretpassword'
const MYSQL_HOST = process.env.MYSQL_HOST || 'localhost'
const MYSQL_PORT = process.env.MYSQL_PORT || 3306

describe('db schemas', () => {
  it('should be able to connect to database', async () => {
    const canConnect = await canConnectToDb(MYSQL_USER, MYSQL_PASSWORD, MYSQL_HOST, MYSQL_PORT)
    expect(canConnect).toBeTruthy()
  })

  it('should NOT be able to connect to database with wrong password', async () => {
    const canConnect = await canConnectToDb(MYSQL_USER, 'foo', MYSQL_HOST, MYSQL_PORT)
    expect(canConnect).toBeFalsy()
  })

  it('should NOT be able to connect to database with wrong host', async () => {
    const canConnect = await canConnectToDb(MYSQL_USER, MYSQL_PASSWORD, 'foo.barbaz', MYSQL_PORT)
    expect(canConnect).toBeFalsy()
  })

  it('should NOT be able to connect to database with wrong host', async () => {
    const canConnect = await canConnectToDb(MYSQL_USER, MYSQL_PASSWORD, 'foo.barbaz', MYSQL_PORT)
    expect(canConnect).toBeFalsy()
  })

  it('should create and drop database', async () => {
    await createMysqlDatabase(MYSQL_USER, MYSQL_PASSWORD, MYSQL_HOST, MYSQL_PORT, testRunId)
    await dropMysqlDatabase(MYSQL_USER, MYSQL_PASSWORD, MYSQL_HOST, MYSQL_PORT, testRunId)
  })

  it('should be able to connect to database schema', async () => {
    await createMysqlDatabase(MYSQL_USER, MYSQL_PASSWORD, MYSQL_HOST, MYSQL_PORT, testRunId)
    expect(await canConnectToDbSchema(MYSQL_USER, MYSQL_PASSWORD, MYSQL_HOST, MYSQL_PORT, testRunId)).toBeTruthy()
    await dropMysqlDatabase(MYSQL_USER, MYSQL_PASSWORD, MYSQL_HOST, MYSQL_PORT, testRunId)
  })

  it('should not be able to connect to database schema', async () => {
    expect(await canConnectToDbSchema(MYSQL_USER, MYSQL_PASSWORD, MYSQL_HOST, MYSQL_PORT, 'aabb987')).toBeFalsy()
  })

  it('should create schema if doesnt exist', async () => {
    expect(await schemaExists(MYSQL_USER, MYSQL_PASSWORD, MYSQL_HOST, MYSQL_PORT, testRunId)).toBeFalsy()
    await assureMysqlDatabase(MYSQL_USER, MYSQL_PASSWORD, MYSQL_HOST, MYSQL_PORT, testRunId)
    expect(await schemaExists(MYSQL_USER, MYSQL_PASSWORD, MYSQL_HOST, MYSQL_PORT, testRunId)).toBeTruthy()
  })

  it('should not create schema if already exist', async () => {
    expect(await schemaExists(MYSQL_USER, MYSQL_PASSWORD, MYSQL_HOST, MYSQL_PORT, testRunId)).toBeFalsy()
    await assureMysqlDatabase(MYSQL_USER, MYSQL_PASSWORD, MYSQL_HOST, MYSQL_PORT, testRunId)
    await assureMysqlDatabase(MYSQL_USER, MYSQL_PASSWORD, MYSQL_HOST, MYSQL_PORT, testRunId)
  })

  it('should run migrations for application scheme', async () => {
    await assureMysqlDatabase(MYSQL_USER, MYSQL_PASSWORD, MYSQL_HOST, MYSQL_PORT, testRunId)
    const migrations = await migrateSchemaData(MYSQL_USER, MYSQL_PASSWORD, MYSQL_HOST, MYSQL_PORT, testRunId)
    console.log(JSON.stringify(migrations))
    expect(migrations.find(m => m.name === "20210914135739-create-tables")).toBeDefined()
    expect(migrations.find(m => m.name === "20210914135810-create-indices")).toBeDefined()
    await runSingleCmdOnSchema(MYSQL_USER, MYSQL_PASSWORD, MYSQL_HOST, MYSQL_PORT, testRunId, "SELECT * from entities")
    await runSingleCmdOnSchema(MYSQL_USER, MYSQL_PASSWORD, MYSQL_HOST, MYSQL_PORT, testRunId, "SELECT * from messages")
    await runSingleCmdOnSchema(MYSQL_USER, MYSQL_PASSWORD, MYSQL_HOST, MYSQL_PORT, testRunId, "SELECT * from agents")
    await runSingleCmdOnSchema(MYSQL_USER, MYSQL_PASSWORD, MYSQL_HOST, MYSQL_PORT, testRunId, "SELECT * from agent_connections")
  })

  it('should run migrations for wallet scheme', async () => {
    await assureMysqlDatabase(MYSQL_USER, MYSQL_PASSWORD, MYSQL_HOST, MYSQL_PORT, testRunId)
    const migrations = await migrateSchemaWallet(MYSQL_USER, MYSQL_PASSWORD, MYSQL_HOST, MYSQL_PORT, testRunId)
    expect(migrations.find(m => m.name === "20210910105243-create-all-initial")).toBeDefined()
    await runSingleCmdOnSchema(MYSQL_USER, MYSQL_PASSWORD, MYSQL_HOST, MYSQL_PORT, testRunId, "SELECT * from wallets")
    await runSingleCmdOnSchema(MYSQL_USER, MYSQL_PASSWORD, MYSQL_HOST, MYSQL_PORT, testRunId, "SELECT * from items")
  })
})
