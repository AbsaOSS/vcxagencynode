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

const { unpack } = require('easy-indysdk')

async function parseAnoncrypted (walletHandle, buffer) {
  const agencyMode = '2.0'
  if (agencyMode === '1.0') {
    throw Error('Not implemented')
  } else {
    const { message } = await unpack(walletHandle, buffer)
    return JSON.parse(message)
  }
}

async function parseAuthcrypted (walletHandle, buffer) {
  const agencyMode = '2.0'
  if (agencyMode === '1.0') {
    throw Error('Not implemented')
  } else {
    const { message, sender_verkey: senderVerkey } = await unpack(walletHandle, buffer)
    if (!senderVerkey) {
      throw Error(`Authcrypted message was expected but sender_verkey is unknown after unpack.`)
    }
    return { message: JSON.parse(message), senderVerkey }
  }
}

async function tryParseAuthcrypted (walletHandle, buffer) {
  const agencyMode = '2.0'
  if (agencyMode === '1.0') {
    throw Error('Not implemented')
  } else {
    const { message, sender_verkey: senderVerkey } = await unpack(walletHandle, buffer)
    return { message: JSON.parse(message), senderVerkey }
  }
}

module.exports = {
  parseAnoncrypted,
  parseAuthcrypted,
  tryParseAuthcrypted
}
