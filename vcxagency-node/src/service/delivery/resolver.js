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

const ENTITY_RECORD_RESOLUTION_STRATEGY = {
  BY_DID_OR_VERKEY: 1,
  BY_DID: 2
}

function createResolver (serviceWallets, serviceStorage, serviceNewMessages, forwardAgentEntity, devMode = false) {
  const { did: fwaDid, verkey: fwaVerkey } = forwardAgentEntity.getForwadAgentInfo()

  let router

  function setRouter (newRouter) {
    router = newRouter
  }

  function _isFwa (resolutionKey, resolutionStrategy) {
    if (resolutionStrategy === ENTITY_RECORD_RESOLUTION_STRATEGY.BY_DID) {
      return resolutionKey === fwaDid
    } else if (resolutionStrategy === ENTITY_RECORD_RESOLUTION_STRATEGY.BY_DID_OR_VERKEY) {
      return (resolutionKey === fwaDid || resolutionKey === fwaVerkey)
    } else {
      throw Error(`Unknown entity record resolution strategy ${resolutionStrategy}.`)
    }
  }

  async function _loadEntityRecord (resolutionKey, resolutionStrategy) {
    if (resolutionStrategy === ENTITY_RECORD_RESOLUTION_STRATEGY.BY_DID_OR_VERKEY) {
      return serviceStorage.loadEntityRecordByDidOrVerkey(resolutionKey)
    } else if (resolutionStrategy === ENTITY_RECORD_RESOLUTION_STRATEGY.BY_DID) {
      return serviceStorage.loadEntityRecordByDid(resolutionKey)
    } else {
      throw Error(`Unknown entity record resolution strategy ${resolutionStrategy}.`)
    }
  }

  async function _entityRecordToEntityAO (entityRecord) {
    switch (entityRecord.entityType) {
      case entityType.agent: {
        return buildAgentAO(entityRecord, serviceWallets, serviceStorage, router, devMode)
      }
      case entityType.agentConnection: {
        return buildAgentConnectionAO(entityRecord, serviceWallets, serviceStorage, serviceNewMessages)
      }
      default:
        throw Error(`Unknown entity type. Full record: ${JSON.stringify(entityRecord)}`)
    }
  }

  async function _resolveEntityAO (resolutionKey, resolutionStrategy, expectedEntityType) {
    if (_isFwa(resolutionKey, resolutionStrategy)) {
      logger.debug(`Resolver: For ${resolutionKey} resolved Forward Agent Entity.`)
      return forwardAgentEntity
    }
    const entityRecord = await _loadEntityRecord(resolutionKey, resolutionStrategy)
    if (!entityRecord) {
      logger.warn(`Resolver: For ${resolutionKey} no entity record was found.`)
      return undefined
    }
    if (expectedEntityType) {
      if (entityRecord.entityType !== expectedEntityType) {
        logger.warn(`Resolved an entity by resolutionKey=${resolutionKey} but it was expected to be of entity type ${expectedEntityType} but actually was ${entityRecord.entityType}.`)
        return undefined
      }
    }
    logger.debug(`For resolution key ${resolutionKey} was resolved entity of type ${entityRecord.entityType}`)
    return _entityRecordToEntityAO(entityRecord)
  }

  /**
   * Tries to resolve an Entity by its DID or Verkey.
   * @param {string} didOrVerkey - DID or Verkey of an entity
   * @return {object} Entity identified by the DID/Verkey. Undefined if DID/Verkey is not matching any entity's DID/Verkey.
   */
  async function resolveEntityAO (didOrVerkey) {
    return _resolveEntityAO(didOrVerkey, ENTITY_RECORD_RESOLUTION_STRATEGY.BY_DID_OR_VERKEY)
  }

  /**
   * Tries to resolve Agent Entity by DID.
   * @param {string} did - DID  of an entity
   * @return {object} Agent Entity identified by the DID. Undefined if DID
   */
  async function resolveAgentAOByDid (did) {
    return _resolveEntityAO(did, ENTITY_RECORD_RESOLUTION_STRATEGY.BY_DID, entityType.agent)
  }

  return {
    resolveEntityAO,
    resolveAgentAOByDid,
    setRouter
  }
}

module.exports = { createResolver }
