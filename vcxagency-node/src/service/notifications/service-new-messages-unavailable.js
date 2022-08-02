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

const { ErrorFeatureDisabled } = require('../../errors/error-feature-disabled')

module.exports.createServiceNewMessagesUnavailable = function createServiceNewMessagesUnavailable () {
  function cleanUp () { }

  async function hasUnackedMessage (_agentDid) {
    throw ErrorFeatureDisabled('Feature is not enabled.')
  }

  async function registerNewMessageCallback (_agentDid, _callbackId, _onNewMessageCallback) {
    throw ErrorFeatureDisabled('Feature is not enabled.')
  }

  function cleanupNewMessageCallback (agentDid, callbackId) { }

  async function ackNewMessage (_agentDid) {
    throw ErrorFeatureDisabled('Feature is not enabled.')
  }

  async function flagNewMessage (agentDid) { }

  return {
    registerNewMessageCallback,
    cleanupNewMessageCallback,
    flagNewMessage,
    ackNewMessage,
    hasUnackedMessage,
    cleanUp
  }
}
