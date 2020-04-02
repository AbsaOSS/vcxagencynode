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

const { buildAgentAO } = require('../entities/agent/agent')
const { buildAgentConnectionAO } = require('../entities/agent-connection/agent-connection')
const logger = require('../../logging/logger-builder')(__filename)
const { entityType } = require('../entities/entities-common')

function createResolver (serviceWallets, serviceStorage, forwardAgentEntity) {
  const { did: fwaDid, verkey: fwaVerkey } = forwardAgentEntity.getForwadAgentInfo()

  let router

  function setRouter (newRouter) {
    router = newRouter
  }

  /**
   * Routes message to recipient
   * @param {string} didOrVerkey - DID or Verkey of an entity
   * @return {object} Entity identified by the DID/Verkey. Undefined if DID/Verkey is not matching any entity's DID/Verkey.
   */
  async function resolveEntityAO (didOrVerkey) {
    if (!(didOrVerkey === fwaDid || didOrVerkey === fwaVerkey)) {
      const entityRecord = await serviceStorage.loadEntityRecord(didOrVerkey)
      if (!entityRecord) {
        logger.info(`Resolver: For ${didOrVerkey} no entity record was found.`)
        return undefined
      }
      switch (entityRecord.entityType) {
        case entityType.agent:
          logger.info(`Resolver: For ${didOrVerkey} resolved Agent Entity.`)
          return buildAgentAO(entityRecord, serviceWallets, serviceStorage, router)
        case entityType.agentConnection:
          logger.info(`Resolver: For ${didOrVerkey} resolved Agent Connection Entity.`)
          return buildAgentConnectionAO(entityRecord, serviceWallets, serviceStorage)
        default:
          throw Error(`Unknown entity type. Full record: ${JSON.stringify(entityRecord)}`)
      }
    } else {
      logger.debug(`Resolver: For ${didOrVerkey} resolved Forward Agent Entity.`)
      return forwardAgentEntity
    }
  }

  return {
    resolveEntityAO,
    setRouter
  }
}

module.exports = { createResolver }
