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
/* eslint-env jest */

const { buildAgencyClientNetwork } = require('../common')
const { performance } = require('perf_hooks')

let agencyClient

const agencyUrl = process.env.AGENCY_URL || 'http://localhost:8080'

beforeAll(async () => {
  jest.setTimeout(1000 * 100)
  agencyClient = await buildAgencyClientNetwork(agencyUrl)
})

const ROUNDS = process.env.ROUNDS || 1000
const OPS_IN_ROUND = process.env.OPS_IN_ROUND || 1

describe('agency info fetch', () => {
  it('should fetch agency did and verkey', async () => {
    console.log(`Starting messaging test. Will do ${ROUNDS} rounds of ${OPS_IN_ROUND} messages`)
    const tStart = performance.now()
    for (let i = 0; i < ROUNDS; i++) {
      if (i % 1000 === 0) {
        console.log(`Round ${i}`)
      }
      const promises = []
      for (let j = 0; j < OPS_IN_ROUND; j++) {
        promises.push(agencyClient.getAgencyInfo())
      }
      await Promise.all(promises)
    }
    const tFinish = performance.now()
    const durationSec = (tFinish - tStart) / 1000
    const totalMessages = ROUNDS * OPS_IN_ROUND
    const msgsPerSec = totalMessages / durationSec
    const msgsPerMinute = msgsPerSec * 60
    console.log(`Duration ${durationSec} to send ${totalMessages} messages. MsgsPerSec ${msgsPerSec}   MsgsPerMinute ${msgsPerMinute} `)
  })
})
