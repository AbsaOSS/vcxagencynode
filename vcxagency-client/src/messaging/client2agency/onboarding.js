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

const MSGTYPE_CONNECT = 'did:sov:123456789abcdefghi1234;spec/onboarding/1.0/CONNECT'
const MSGTYPE_CONNECTED = 'did:sov:123456789abcdefghi1234;spec/onboarding/1.0/CONNECTED'

const MSGTYPE_SIGNUP = 'did:sov:123456789abcdefghi1234;spec/onboarding/1.0/SIGNUP'
const MSGTYPE_SIGNED_UP = 'did:sov:123456789abcdefghi1234;spec/onboarding/1.0/SIGNED_UP'

const MSGTYPE_CREATE_AGENT = 'did:sov:123456789abcdefghi1234;spec/onboarding/1.0/CREATE_AGENT'
const MSGTYPE_AGENT_CREATED = 'did:sov:123456789abcdefghi1234;spec/onboarding/1.0/AGENT_CREATED'

const MSGTYPE_CREATE_KEY = 'did:sov:123456789abcdefghi1234;spec/pairwise/1.0/CREATE_KEY'
const MSGTYPE_KEY_CREATED = 'did:sov:123456789abcdefghi1234;spec/pairwise/1.0/KEY_CREATED'

function buildMsgVcxV2Connect (fromDid, fromDidVerkey) {
  const msg = {
    '@type': MSGTYPE_CONNECT,
    'fromDID': fromDid,
    'fromDIDVerKey': fromDidVerkey
  }
  return msg
}

function buildMsgVcxV2Connected (fwacDid, fwacVerkey) {
  const msg = {
    '@type': MSGTYPE_CONNECTED,
    'withPairwiseDID': fwacDid,
    'withPairwiseDIDVerKey': fwacVerkey
  }
  return msg
}

function buildMsgVcxV2SignUp () {
  const msg = { '@type': MSGTYPE_SIGNUP }
  return msg
}

function buildMsgVcxV2SignedUp () {
  const msg = { '@type': MSGTYPE_SIGNED_UP }
  return msg
}

function buildMsgVcxV2CreateAgent () {
  const msg = { '@type': MSGTYPE_CREATE_AGENT }
  return msg
}

function buildMsgVcxV2AgentCreated (agentDid, agentVerkey) {
  const msg = {
    '@type': MSGTYPE_AGENT_CREATED,
    'withPairwiseDID': agentDid,
    'withPairwiseDIDVerKey': agentVerkey
  }
  return msg
}

function buildMsgVcxV2CreateKey (userPairwiseDid, userPairwiseVerkey) {
  const msg = {
    '@type': MSGTYPE_CREATE_KEY,
    'forDID': userPairwiseDid,
    'forDIDVerKey': userPairwiseVerkey
  }
  return msg
}

function buildMsgVcxV2KeyCreated (agentConnectionDid, agentConnectionVerkey) {
  const msg = {
    '@type': MSGTYPE_KEY_CREATED,
    'withPairwiseDID': agentConnectionDid,
    'withPairwiseDIDVerKey': agentConnectionVerkey
  }
  return msg
}

module.exports = {
  // onboarding 1/3
  buildMsgVcxV2Connect, // req
  buildMsgVcxV2Connected, // res

  // onboarding 2/3
  buildMsgVcxV2SignUp, // req
  buildMsgVcxV2SignedUp, // res

  // onboarding 3/3
  buildMsgVcxV2CreateAgent, // req
  buildMsgVcxV2AgentCreated, // res

  // create agent-connection
  buildMsgVcxV2CreateKey, // req
  buildMsgVcxV2KeyCreated, // res

  // onboarding 1/3
  MSGTYPE_CONNECT,
  MSGTYPE_CONNECTED,

  // onboarding 2/3
  MSGTYPE_SIGNUP,
  MSGTYPE_SIGNED_UP,

  // onboarding 3/3
  MSGTYPE_CREATE_AGENT,
  MSGTYPE_AGENT_CREATED,

  // create agent-connection
  MSGTYPE_CREATE_KEY,
  MSGTYPE_KEY_CREATED
}
