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

const logger = require('../../logging/logger-builder')(__filename)

function createRouter (resolver) {
  /**
   * Routes message to recipient
   * @param {string} msgAddress - DID or Verkey of recipient
   * @param {buffer} msgBuffer - message to be processed by the recipient
   */
  async function routeMsg (msgAddress, msgBuffer) {
    logger.info(`Router routing a message to '${msgAddress}'.`)
    const entityAO = await resolver.resolveEntityAO(msgAddress) // we could version recipientData so we could support new representations of agents?
    if (!entityAO) {
      throw Error(`Recipient not found.`)
    }
    return entityAO.handleRoutedMessage(msgBuffer)
  }

  return {
    routeMsg
  }
}

module.exports = { createRouter }
