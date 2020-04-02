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

"use strict"

const { Connection } = require('node-vcx-wrapper')
const readlineSync = require('readline-sync')

async function getInviteFromConsoleInput () {
  const details = readlineSync.question('Enter invite details: ')
  return JSON.parse(details)
}

async function createOrRetrieveConnectionInvite (storageConnections, id) {
  if (!(await storageConnections.get(id))) {
    const newConnection = await Connection.create({ id })
    await newConnection.connect('{"use_public_did": true}')
    await newConnection.updateState()
    await storageConnections.set(id, await newConnection.serialize())
  }
  const serialized = await storageConnections.get(id)
  const connection = await Connection.deserialize(serialized)
  const invitationString = await connection.inviteDetails(false)
  return invitationString
}

async function createOrRetrieveConnection (storageConnections, id, getInviteStringStrategy) {
  if (!(await storageConnections.get(id))) {
    const invitationString = await getInviteStringStrategy()
    const connection = await Connection.createWithInvite({ id: id, invite: invitationString })
    await connection.connect({ data: '{"use_public_did": true}' })
    await connection.updateState()
    const serialized = await connection.serialize()
    await storageConnections.set(id, serialized)
  }
  const connectionSerialized = await storageConnections.get(id)
  const connection = await Connection.deserialize(connectionSerialized)
  return connection
}

async function signData (storageConnections, id, dataBase64) {
  const serializedConnection = await storageConnections.get(id)
  if (!serializedConnection) {
    throw Error(`Connection ${id} was not found in provided connection storage.`)
  }
  var challengeBuffer = Buffer.from(dataBase64, 'base64')
  let signatureBuffer
  const connection = await Connection.deserialize(serializedConnection)
  try {
    signatureBuffer = await connection.signData(challengeBuffer)
  } catch (err) {
    throw Error(`Error occured while connection ${id} was signing data '${dataBase64}'. Err Message = ${err.message} Stack = ${err.stack}`)
  }
  if (!signatureBuffer) {
    throw Error(`Error occured while connection ${id} was signing data '${dataBase64}' The resulting signature was empty.`)
  }
  const signatureBase64 = signatureBuffer.toString('base64')
  return signatureBase64
}

async function verifySignature (storageConnections, id, dataBase64, signatureBase64) {
  const serializedConnection = await storageConnections.get(id)
  if (!serializedConnection) {
    throw Error(`Connection ${id} was not found in provided connection storage.`)
  }
  if ((!serializedConnection.data.their_pw_did) || (!serializedConnection.data.their_pw_verkey)) {
    throw Error(`Connection ${id} was not yet established`)
  }
  const data = Buffer.from(dataBase64, 'base64')
  const signature = Buffer.from(signatureBase64, 'base64')
  const connection = await Connection.deserialize(serializedConnection)
  const success = await connection.verifySignature({ data, signature })
  return success === 'Success'
}

async function updateConnection (storageConnections, id) {
  const serializedConnection = await storageConnections.get(id)
  const vcxConnection = await Connection.deserialize(serializedConnection)
  await vcxConnection.updateState()
  const postUpdateConnectionSerialized = await vcxConnection.serialize()
  await storageConnections.set(id, postUpdateConnectionSerialized)
  return vcxConnection
}

module.exports.updateConnection = updateConnection
module.exports.verifySignature = verifySignature
module.exports.createOrRetrieveConnection = createOrRetrieveConnection
module.exports.createOrRetrieveConnectionInvite = createOrRetrieveConnectionInvite
module.exports.getInviteFromConsoleInput = getInviteFromConsoleInput
module.exports.signData = signData
