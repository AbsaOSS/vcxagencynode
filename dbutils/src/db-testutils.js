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
const { migrateSchemaData, migrateSchemaWallet } = require('./migration')
const { dropMysqlDatabase, createMysqlDatabase } = require('./db-schemas')

async function createDbSchemaApplication (dbNameId) {
  const dbId = dbNameId || uuid.v4().split('-').join("")
  const database = `agencytest_data_${dbId}`
  const user = 'root'
  const password = 'mysecretpassword'
  const host = 'localhost'
  const port = 3306

  await createMysqlDatabase(user, password, host, port, database)
  await migrateSchemaData(user, password, host, port, database)
  return {
    info: {
      user,
      password,
      host,
      port,
      database
    },
    dropDb: async () => { return dropMysqlDatabase(user, password, host, port, database) }
  }
}

async function createDbSchemaWallets (dbNameId) {
  const dbId = dbNameId || uuid.v4().split('-').join("")
  const database = `agencytest_wallet_${dbId}`
  const user = 'root'
  const password = 'mysecretpassword'
  const host = 'localhost'
  const port = 3306

  await createMysqlDatabase(user, password, host, port, database)
  await migrateSchemaWallet(user, password, host, port, database)
  return {
    info: {
      user,
      password,
      host,
      port,
      database
    },
    dropDb: async () => { return dropMysqlDatabase(user, password, host, port, database) }
  }
}

module.exports = {
  createDbSchemaApplication,
  createDbSchemaWallets
}
