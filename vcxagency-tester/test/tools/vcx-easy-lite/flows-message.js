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

const _ = require('lodash')
const { downloadMessages, updateMessages } = require('node-vcx-wrapper')

async function messageSend (connection, msg, type, title) {
  return connection.sendMessage({ msg, type, title })
}

async function messagesGetForPwDid (
  pwDid,
  filterTypes = [],
  filterStatuses = ['MS-102', 'MS-103', 'MS-104', 'MS-105', 'MS-106'],
  filterUids = []
) {
  filterStatuses = filterStatuses || ['MS-102', 'MS-103', 'MS-104', 'MS-105', 'MS-106'] // explicit null or undefined interpreted as "no filter"
  const messages = []
  const donwloadInstructions = {
    pairwiseDids: pwDid
  }
  if (filterStatuses && filterStatuses.length > 0) {
    donwloadInstructions.status = filterStatuses.join(',')
  }
  if (filterUids && filterUids.length > 0) {
    donwloadInstructions.uids = filterUids.join(',')
  }
  const res = JSON.parse(await downloadMessages(donwloadInstructions))
  if (res && res.length > 1) {
    throw Error('Unexpected to get more than 1 items from download messages for single pairwise did')
  }
  if (res && res.length === 0) {
    throw Error('Expected to get at least 1 item in download message response.')
  }
  if (!res[0].msgs) {
    throw Error('message item was expected to have msgs field')
  }
  if (res[0].msgs.length > 0) {
    await messages.push(res[0].msgs)
  }
  const flattened = _.flatten(messages)
  return (filterTypes && filterTypes.length > 0) ? flattened.filter(msg => filterTypes.includes(msg.type)) : flattened
}

async function messagesUpdateStatus (pairwiseDid, uids) {
  const updateInstructions = [{ pairwiseDID: pairwiseDid, uids }]
  await updateMessages({ msgJson: JSON.stringify(updateInstructions) })
}

module.exports.messageSend = messageSend
module.exports.messagesGetForPwDid = messagesGetForPwDid
module.exports.messagesUpdateStatus = messagesUpdateStatus
module.exports.downloadMessages = downloadMessages
