/**
 * Copyright 2019 ABSA Group Limited
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

const indy = require('indy-sdk')

async function anonCrypt (wh, messageBuffer, receiverKeys) {
  return pack(wh, messageBuffer, receiverKeys, null)
}

async function packAsUtf8 (wh, messageBuffer, receiverKeys, senderVk) {
  const buffer = await pack(wh, messageBuffer, receiverKeys, senderVk)
  return JSON.parse((buffer).toString('utf8'))
}

async function pack (wh, messageBuffer, receiverKeys, senderVk) {
  if (receiverKeys === undefined || receiverKeys === null) {
    receiverKeys = []
  }
  if (typeof (receiverKeys) === 'string') {
    receiverKeys = [receiverKeys]
  }
  return indy.packMessage(wh, messageBuffer, JSON.stringify(receiverKeys), senderVk)
}

async function unpack (wh, messageBuffer) {
  const unpackRes = await indy.unpackMessage(wh, messageBuffer)
  const data = JSON.parse(unpackRes.toString())
  return {
    message: data.message,
    sender_verkey: data.sender_verkey
  }
}

module.exports = {
  pack,
  packAsUtf8,
  anonCrypt,
  unpack
}
