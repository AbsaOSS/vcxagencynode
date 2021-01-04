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
const {
  vcxFlowSendAriesMessage,
  vcxFlowGetMsgsFromAgentConn,
  vcxFlowCreateAgentConnection,
  vcxFlowFullOnboarding,
  vcxFlowSetWebhookUrl
} = require('vcxagency-client')
const {
  indyCreateWallet,
  indyCreateAndStoreMyDid,
  indyGenerateWalletKey,
  indyOpenWallet,
  unpack
} = require('easy-indysdk')
const uuid = require('uuid')
const rimraf = require('rimraf')
const os = require('os')
const { objectToBuffer } = require('../../utils')
const express = require('express')
const bodyParser = require('body-parser')
const sleep = require('sleep-promise')
const { longpollNotifications } = require('../../../src/service/notifications/longpoll')
const { createTestPgDb } = require('../../pg-tmpdb')
const { setupVcxLogging } = require('../../utils')
const { wireUp } = require('../../../src/app')
const { buildAgencyClientVirtual } = require('./common')

const agencyWalletName = `vcxagency-node-${uuid.v4()}`
const agencyDid = 'VsKV7grR1BUE29mG2Fm2kX'
const agencySeed = '0000000000000000000000000Forward'
const agencyWalletKey = '@key'
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379/0'

let serviceIndyWallets // eslint-disable-line
let entityForwardAgent // eslint-disable-line
let serviceStorage // eslint-disable-line
let resolver // eslint-disable-line
let router // eslint-disable-line
let agencyVerkey // eslint-disable-line
let serviceNewMessages // eslint-disable-line

let aliceWalletName
let aliceWalletKey
let aliceDid
let aliceVerkey
let aliceWh

let bobWalletName
let bobWalletKey
let bobWh

const WALLET_KDF = 'RAW'

let sendToAgency

beforeAll(async () => {
  jest.setTimeout(1000 * 120)
  if (process.env.ENABLE_VCX_LOGS) {
    setupVcxLogging()
  }
  const tmpPgDb = await createTestPgDb()
  const app = await wireUp(tmpPgDb.info, REDIS_URL, agencyWalletName, agencyDid, agencySeed, agencyWalletKey)
  serviceIndyWallets = app.serviceIndyWallets
  entityForwardAgent = app.entityForwardAgent
  serviceStorage = app.serviceStorage
  resolver = app.resolver
  router = app.router
  serviceNewMessages = app.serviceNewMessages

  const agencyClient = await buildAgencyClientVirtual(entityForwardAgent)
  sendToAgency = agencyClient.sendToAgency
  const agencyInfo = await agencyClient.getAgencyInfo()
  agencyVerkey = agencyInfo.verkey
})

beforeEach(async () => {
  aliceWalletKey = await indyGenerateWalletKey()
  aliceWalletName = `unit-test-${uuid.v4()}`
  await indyCreateWallet(aliceWalletName, aliceWalletKey, WALLET_KDF)
  aliceWh = await indyOpenWallet(aliceWalletName, aliceWalletKey, WALLET_KDF)
  const { did, vkey } = await indyCreateAndStoreMyDid(aliceWh)
  aliceDid = did
  aliceVerkey = vkey

  bobWalletKey = await indyGenerateWalletKey()
  bobWalletName = `unit-test-${uuid.v4()}`
  await indyCreateWallet(bobWalletName, bobWalletKey, WALLET_KDF)
  bobWh = await indyOpenWallet(bobWalletName, bobWalletKey, WALLET_KDF)
})

afterEach(async () => {
  const homedir = os.homedir()
  const clientWalletPath = `${homedir}/.indy_client/wallet/${aliceWalletName}`
  const attackerWalletPath = `${homedir}/.indy_client/wallet/${bobWalletName}`
  await rimraf.sync(clientWalletPath)
  await rimraf.sync(attackerWalletPath)
})

async function setWebhookUrlForAgent (agentDid, webhookUrl) {
  const agentAo = await resolver.resolveEntityAO(agentDid)
  await agentAo.setWebhook(webhookUrl)
}

describe('onboarding', () => {
  it('Bob should send aries message, Alice should download it', async () => {
    // arrange
    const { agentDid: aliceAgentDid, agentVerkey: aliceAgentVerkey } = await vcxFlowFullOnboarding(aliceWh, sendToAgency, agencyDid, agencyVerkey, aliceDid, aliceVerkey)
    const { did: aliceToBobDid, vkey: aliceToBobVkey } = await indyCreateAndStoreMyDid(aliceWh)
    const aliceAconnCreated = await vcxFlowCreateAgentConnection(aliceWh, sendToAgency, aliceAgentDid, aliceAgentVerkey, aliceVerkey, aliceToBobDid, aliceToBobVkey)
    const aliceToBobAconnDid = aliceAconnCreated.withPairwiseDID
    const aliceToBobAconnVkey = aliceAconnCreated.withPairwiseDIDVerKey

    const { vkey: bobToAliceVerkey } = await indyCreateAndStoreMyDid(bobWh)

    await vcxFlowSendAriesMessage(bobWh, sendToAgency, aliceVerkey, aliceToBobAconnVkey, bobToAliceVerkey, 'This is Bob!')

    // act
    const msgReply = await vcxFlowGetMsgsFromAgentConn(aliceWh, sendToAgency, aliceToBobAconnDid, aliceToBobAconnVkey, aliceToBobVkey, ['MS-103'])
    expect(msgReply['@type']).toBe('did:sov:123456789abcdefghi1234;spec/pairwise/1.0/MSGS')
    const { msgs } = msgReply
    expect(Array.isArray(msgs)).toBeTruthy()
    expect(msgs.length).toBe(1)
    const { message, sender_verkey: senderVerkey } = await unpack(aliceWh, objectToBuffer(msgs[0].payload))
    expect(senderVerkey).toBe(bobToAliceVerkey)
    const messageObject = JSON.parse(message)
    expect(messageObject['@type']).toBe('did:sov:BzCbsNYhMrjHiqZDTUASHg;spec/basicmessage/1.0/message')
    expect(messageObject.sent_time).toBe('2019-01-15 18:42:01Z')
    expect(messageObject.content).toBe('This is Bob!')
  })

  it('Alice should receive notification when Bobs sends her a message', async () => {
    let testServer
    try {
      // set up dummy server for alice to receive notifications from agency
      let serverReceivedNotification = {}
      const TEST_SERVER_PORT = 49412

      const appNotifications = express()
      appNotifications.use(bodyParser.json())
      appNotifications.post('/notifications',
        async function (req, res) {
          serverReceivedNotification = req.body
          res.status(200).send()
        })
      testServer = appNotifications.listen(TEST_SERVER_PORT)

      // set up alice's agent and agent'connection to receive message Bob
      const { agentDid: aliceAgentDid, agentVerkey: aliceAgentVerkey } = await vcxFlowFullOnboarding(aliceWh, sendToAgency, agencyDid, agencyVerkey, aliceDid, aliceVerkey)
      const { did: aliceToBobDid, vkey: aliceToBobVkey } = await indyCreateAndStoreMyDid(aliceWh)
      const aliceAconnCreated = await vcxFlowCreateAgentConnection(aliceWh, sendToAgency, aliceAgentDid, aliceAgentVerkey, aliceVerkey, aliceToBobDid, aliceToBobVkey)
      const aliceToBobAconnVkey = aliceAconnCreated.withPairwiseDIDVerKey
      await setWebhookUrlForAgent(aliceAgentDid, `http://localhost:${TEST_SERVER_PORT}/notifications`)

      // bob generates a verkey for this specific connection
      const { vkey: bobToAliceVerkey } = await indyCreateAndStoreMyDid(bobWh)

      // bob sends message to alice's agent she set up for relationship with Bob
      await vcxFlowSendAriesMessage(bobWh, sendToAgency, aliceVerkey, aliceToBobAconnVkey, bobToAliceVerkey, 'This is Bob!')

      // wait a bit and check alice has received notification about received message on her dummy server
      await sleep(1000)
      expect(serverReceivedNotification.msgUid).toBeDefined()
      expect(serverReceivedNotification.notificationId).toBeDefined()
      expect(serverReceivedNotification.pwDid).toBe(aliceToBobDid)
    } finally {
      if (testServer) {
        await testServer.close()
      }
    }
  })

  it('Alice should receive notification when Bobs sends her a message if webhook was set via vcx com method', async () => {
    let testServer
    try {
      // set up dummy server for alice to receive notifications from agency
      let serverReceivedNotification = {}
      const TEST_SERVER_PORT = 49412

      const appNotifications = express()
      appNotifications.use(bodyParser.json())
      appNotifications.post('/notifications',
        async function (req, res) {
          serverReceivedNotification = req.body
          res.status(200).send()
        })
      testServer = appNotifications.listen(TEST_SERVER_PORT)

      // set up alice's agent and agent'connection to receive message Bob
      const { agentDid: aliceAgentDid, agentVerkey: aliceAgentVerkey } = await vcxFlowFullOnboarding(aliceWh, sendToAgency, agencyDid, agencyVerkey, aliceDid, aliceVerkey)
      const { did: aliceToBobDid, vkey: aliceToBobVkey } = await indyCreateAndStoreMyDid(aliceWh)
      const aliceAconnCreated = await vcxFlowCreateAgentConnection(aliceWh, sendToAgency, aliceAgentDid, aliceAgentVerkey, aliceVerkey, aliceToBobDid, aliceToBobVkey)
      const aliceToBobAconnVkey = aliceAconnCreated.withPairwiseDIDVerKey
      const webhookUrl = `http://localhost:${TEST_SERVER_PORT}/notifications`
      const commUpdated = await vcxFlowSetWebhookUrl(aliceWh, sendToAgency, aliceAgentDid, aliceAgentVerkey, aliceVerkey, webhookUrl)
      expect(commUpdated).toBeDefined()

      // bob generates a verkey for this specific connection
      const { vkey: bobToAliceVerkey } = await indyCreateAndStoreMyDid(bobWh)

      // bob sends message to alice's agent she set up for relationship with Bob
      await vcxFlowSendAriesMessage(bobWh, sendToAgency, aliceVerkey, aliceToBobAconnVkey, bobToAliceVerkey, 'This is Bob!')

      // wait a bit and check alice has received notification about received message on her dummy server
      await sleep(1000)
      expect(serverReceivedNotification.msgUid).toBeDefined()
      expect(serverReceivedNotification.notificationId).toBeDefined()
      expect(serverReceivedNotification.pwDid).toBe(aliceToBobDid)
    } finally {
      if (testServer) {
        await testServer.close()
      }
    }
  })

  it('should be informed after timeout that no new messages are available', async () => {
    const { agentDid: aliceAgentDid, agentVerkey: aliceAgentVerkey } = await vcxFlowFullOnboarding(aliceWh, sendToAgency, agencyDid, agencyVerkey, aliceDid, aliceVerkey)
    const { did: aliceToBobDid, vkey: aliceToBobVkey } = await indyCreateAndStoreMyDid(aliceWh)
    await vcxFlowCreateAgentConnection(aliceWh, sendToAgency, aliceAgentDid, aliceAgentVerkey, aliceVerkey, aliceToBobDid, aliceToBobVkey)

    const utimeBeforeSecs = Math.floor(new Date() / 1000)
    const hasNotifications = await longpollNotifications(serviceNewMessages, aliceAgentDid, 2000)
    await serviceNewMessages.ackNewMessage(aliceAgentDid)
    const utimeAfterSecs = Math.floor(new Date() / 1000)
    expect(hasNotifications).toBeFalsy()
    expect(utimeAfterSecs - utimeBeforeSecs).toBe(2)
  })

  it('should be informed after about new message within 1 second of arrival', async () => {
    const { agentDid: aliceAgentDid, agentVerkey: aliceAgentVerkey } = await vcxFlowFullOnboarding(aliceWh, sendToAgency, agencyDid, agencyVerkey, aliceDid, aliceVerkey)
    const { did: aliceToBobDid, vkey: aliceToBobVkey } = await indyCreateAndStoreMyDid(aliceWh)
    const aliceAconnCreated = await vcxFlowCreateAgentConnection(aliceWh, sendToAgency, aliceAgentDid, aliceAgentVerkey, aliceVerkey, aliceToBobDid, aliceToBobVkey)
    const aliceToBobAconnVkey = aliceAconnCreated.withPairwiseDIDVerKey

    const utimePollStarted = Math.floor(new Date() / 1000)
    let pollResolvedWithSuccess

    longpollNotifications(serviceNewMessages, aliceAgentDid, 10000)
      .then(async function (hasNotifications) {
        expect(hasNotifications).toBeTruthy()
        pollResolvedWithSuccess = true
        const utimePollReturned = Math.floor(new Date() / 1000)
        await serviceNewMessages.ackNewMessage(aliceAgentDid)
        expect(utimePollReturned - utimePollStarted).toBeGreaterThanOrEqual(2)
        expect(utimePollReturned - utimePollStarted).toBeLessThanOrEqual(3)
      }, function (error) {
        pollResolvedWithSuccess = false
        throw error
      })

    await sleep(2000)

    const { vkey: bobToAliceVerkey } = await indyCreateAndStoreMyDid(bobWh)
    await vcxFlowSendAriesMessage(bobWh, sendToAgency, aliceVerkey, aliceToBobAconnVkey, bobToAliceVerkey, 'This is Bob!')

    await sleep(3100)
    expect(pollResolvedWithSuccess).toBeTruthy()
  })

  it('should be informed immediately if messages has arrived since last poll', async () => {
    // set up alice's agent and agent'connection to receive message Bob
    const { agentDid: aliceAgentDid, agentVerkey: aliceAgentVerkey } = await vcxFlowFullOnboarding(aliceWh, sendToAgency, agencyDid, agencyVerkey, aliceDid, aliceVerkey)
    const { did: aliceToBobDid, vkey: aliceToBobVkey } = await indyCreateAndStoreMyDid(aliceWh)
    const aliceAconnCreated = await vcxFlowCreateAgentConnection(aliceWh, sendToAgency, aliceAgentDid, aliceAgentVerkey, aliceVerkey, aliceToBobDid, aliceToBobVkey)
    const aliceToBobAconnVkey = aliceAconnCreated.withPairwiseDIDVerKey

    const { vkey: bobToAliceVerkey } = await indyCreateAndStoreMyDid(bobWh)
    await vcxFlowSendAriesMessage(bobWh, sendToAgency, aliceVerkey, aliceToBobAconnVkey, bobToAliceVerkey, 'This is Bob!')

    const utimePollStarted = Math.floor(new Date() / 1000)
    const hasNotifications = await longpollNotifications(serviceNewMessages, aliceAgentDid, 10000)
    expect(hasNotifications).toBeTruthy()
    await serviceNewMessages.ackNewMessage(aliceAgentDid)
    const utimePollEnded = Math.floor(new Date() / 1000)
    expect(utimePollEnded - utimePollStarted).toBeLessThanOrEqual(1)
  })

  it('subsequent poll should hang if no new message has arrived', async () => {
    // set up alice's agent and agent'connection to receive message Bob
    const { agentDid: aliceAgentDid, agentVerkey: aliceAgentVerkey } = await vcxFlowFullOnboarding(aliceWh, sendToAgency, agencyDid, agencyVerkey, aliceDid, aliceVerkey)
    const { did: aliceToBobDid, vkey: aliceToBobVkey } = await indyCreateAndStoreMyDid(aliceWh)
    const aliceAconnCreated = await vcxFlowCreateAgentConnection(aliceWh, sendToAgency, aliceAgentDid, aliceAgentVerkey, aliceVerkey, aliceToBobDid, aliceToBobVkey)
    const aliceToBobAconnVkey = aliceAconnCreated.withPairwiseDIDVerKey

    const { vkey: bobToAliceVerkey } = await indyCreateAndStoreMyDid(bobWh)
    await vcxFlowSendAriesMessage(bobWh, sendToAgency, aliceVerkey, aliceToBobAconnVkey, bobToAliceVerkey, 'This is Bob!')
    {
      const utimePollStarted = Math.floor(new Date() / 1)
      const hasNotifications = await longpollNotifications(serviceNewMessages, aliceAgentDid, 2000)
      expect(hasNotifications).toBeTruthy()
      await serviceNewMessages.ackNewMessage(aliceAgentDid)
      const utimePollEnded = Math.floor(new Date() / 1)
      expect(utimePollEnded - utimePollStarted).toBeLessThanOrEqual(100)
    }
    {
      const utimePollStarted = Math.floor(new Date() / 1000)
      const hasNotifications = await longpollNotifications(serviceNewMessages, aliceAgentDid, 2000)
      expect(hasNotifications).toBeFalsy()
      const utimePollEnded = Math.floor(new Date() / 1000)
      expect(utimePollEnded - utimePollStarted).toBeGreaterThanOrEqual(2)
    }
  })

  it('subsequent poll should recieve information about received message if update callback was not called', async () => {
    // set up alice's agent and agent'connection to receive message Bob
    const { agentDid: aliceAgentDid, agentVerkey: aliceAgentVerkey } = await vcxFlowFullOnboarding(aliceWh, sendToAgency, agencyDid, agencyVerkey, aliceDid, aliceVerkey)
    const { did: aliceToBobDid, vkey: aliceToBobVkey } = await indyCreateAndStoreMyDid(aliceWh)
    const aliceAconnCreated = await vcxFlowCreateAgentConnection(aliceWh, sendToAgency, aliceAgentDid, aliceAgentVerkey, aliceVerkey, aliceToBobDid, aliceToBobVkey)
    const aliceToBobAconnVkey = aliceAconnCreated.withPairwiseDIDVerKey

    const { vkey: bobToAliceVerkey } = await indyCreateAndStoreMyDid(bobWh)
    await vcxFlowSendAriesMessage(bobWh, sendToAgency, aliceVerkey, aliceToBobAconnVkey, bobToAliceVerkey, 'This is Bob!')
    {
      const utimePollStarted = Math.floor(new Date() / 1)
      const hasNotifications = await longpollNotifications(serviceNewMessages, aliceAgentDid, 2000)
      expect(hasNotifications).toBeTruthy()
      const utimePollEnded = Math.floor(new Date() / 1)
      expect(utimePollEnded - utimePollStarted).toBeLessThanOrEqual(100)
    }
    {
      const utimePollStarted = Math.floor(new Date() / 1000)
      const hasNotifications = await longpollNotifications(serviceNewMessages, aliceAgentDid, 2000)
      expect(hasNotifications).toBeTruthy()
      await serviceNewMessages.ackNewMessage(aliceAgentDid)
      const utimePollEnded = Math.floor(new Date() / 1000)
      expect(utimePollEnded - utimePollStarted).toBeLessThanOrEqual(100)
    }
    {
      const utimePollStarted = Math.floor(new Date() / 1000)
      const hasNotifications = await longpollNotifications(serviceNewMessages, aliceAgentDid, 2000)
      expect(hasNotifications).toBeFalsy()
      const utimePollEnded = Math.floor(new Date() / 1000)
      expect(utimePollEnded - utimePollStarted).toBeGreaterThanOrEqual(2)
    }
  })
})
