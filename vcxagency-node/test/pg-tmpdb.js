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

const uuid = require('uuid')
const util = require('util')
const pgtools = require('pgtools')

async function createDb (user, password, host, port, dbName) {
  const createPgDbAsync = util.promisify(pgtools.createdb)
  await createPgDbAsync({ user, password, host, port }, dbName)
}

async function dropDb (user, password, host, port, dbName) {
  const dropPgDbAsync = util.promisify(pgtools.dropdb)
  await dropPgDbAsync({ user, password, host, port }, dbName)
}

async function createTestPgDb (database) {
  database = database || `agency-testdb-${uuid.v4()}`
  const user = 'postgres'
  const password = 'mysecretpassword'
  const host = 'localhost'
  const port = 5432

  await createDb(user, password, host, port, database)
  return {
    info: {
      user,
      password,
      host,
      port,
      database
    },
    dropDb: async () => { return dropDb(user, password, host, port, database) }
  }
}

module.exports.createTestPgDb = createTestPgDb
module.exports.dropDb = dropDb
