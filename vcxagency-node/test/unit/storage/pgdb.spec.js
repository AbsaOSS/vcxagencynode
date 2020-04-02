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
const { Client } = require('pg')
const { dropDb } = require('../../pg-tmpdb')
const { assureDb } = require('../../../src/service/storage/pgdb')

beforeAll(async () => {
  jest.setTimeout(1000 * 300)
})

describe('storage', () => {
  const user = 'postgres'
  const password = 'mysecretpassword'
  const host = 'localhost'
  const port = 5432
  const database = `test-${uuid.v4()}`

  it('should create and drop pg database', async () => {
    const pgConfig = {
      user,
      password,
      host,
      port,
      database
    }
    await assureDb(user, password, host, port, database)
    const client = new Client(pgConfig)
    await client.connect()
    await client.query(`CREATE TABLE foobar (
         id SERIAL  PRIMARY KEY,
         foo VARCHAR (50)
      );`)
    await client.end()
    await dropDb(user, password, host, port, database)
  })

  it('should not throw if database already exists', async () => {
    try {
      await assureDb(user, password, host, port, database)
      await assureDb(user, password, host, port, database)
    } finally {
      await dropDb(user, password, host, port, database)
    }
  })

  it('should throw if password is incorrect', async () => {
    let thrown
    try {
      await assureDb(user, 'wooooooooo', host, port, database)
    } catch (err) {
      thrown = err
    }
    expect(thrown).toBeDefined()
  })
})
