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

const { createPgStorageEntities } = require('./service/storage/pgstorage-entities')
const { createRouter } = require('./service/delivery/router')
const { createResolver } = require('./service/delivery/resolver')
const { buildForwardAgent } = require('./service/entities/fwa/entity-fwa')
const { createServiceIndyWallets } = require('./service/state/service-indy-wallets')
const { assureDb } = require('./service/storage/pgdb')

async function wireUp (appStorageConfig, agencyWalletName, agencyDid, agencySeed, agencyWalletKey, walletStorageType = 'default', walletStorageConfig = null, walletStorageCredentials = null) {
  const serviceIndyWallets = await createServiceIndyWallets(walletStorageType, walletStorageConfig, walletStorageCredentials)
  const { user, password, host, port, database } = appStorageConfig
  await assureDb(user, password, host, port, database)
  const serviceStorage = await createPgStorageEntities(appStorageConfig)
  const entityForwardAgent = await buildForwardAgent(serviceIndyWallets, serviceStorage, agencyWalletName, agencyWalletKey, agencyDid, agencySeed)
  const resolver = createResolver(serviceIndyWallets, serviceStorage, entityForwardAgent)
  const router = createRouter(resolver)
  resolver.setRouter(router)
  entityForwardAgent.setRouter(router)
  entityForwardAgent.setResolver(resolver)
  return { serviceIndyWallets, serviceStorage, entityForwardAgent, resolver, router }
}

module.exports = { wireUp }
