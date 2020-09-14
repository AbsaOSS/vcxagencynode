'use strict'

const fs = require('fs').promises
const { buildAgencyClientNetwork } = require('../common')
const { encryptForAgency } = require('../common')
const { wrapWithAgencyFwd } = require('vcxagency-client')
const { vcxFlowFullOnboarding } = require('vcxagency-client')
const { vcxFlowCreateAgentConnection } = require('vcxagency-client')
const { vcxFlowGetMsgsFromAgent } = require('vcxagency-client')
const { objectToBuffer } = require('vcxagency-client/src/utils')
const aries = require('vcxagency-client/src/messaging/aries/aries-msg')

const easyindy = require('easy-indysdk')
const config = require('../config')
const printlog = config.DEBUG ? console.log: ()=>{}

const agency = {}
agency.did = process.env.AGENCY_DID || config.AgencyDid
agency.verkey = process.env.AGENCY_VERKEY || config.AgencyVerkey

let users = []
;
(() => {
  let i, user
  for (i=0; i<config.AliceNumber; i++) {
    user = { name: config.getAliceName(i), msgCount:0 }
    users[i] = user
  }
  for (i=0; i<config.FaberNumber; i++) {
    user = { name: config.getFaberName(i), msgCount:0 }
    users[i + config.AliceNumber] = user
  }
})()


//
// Test Utility
//

let AliceID = 0
function getAliceID() {
  const ret = AliceID
  AliceID++
  AliceID %= config.MaxMessagingAliceNumber
  return ret
}

let FaberID = 0
function getFaberID() {
  const ret = FaberID
  FaberID++
  FaberID %= config.MaxMessagingFaberNumber
  return ret + config.AliceNumber
}

const OPENING = 'opening'
function isValid(obj) {
  return (obj && obj!==OPENING)
}

function isOpening(obj) {
  return (obj && obj===OPENING)
}

async function openUserWallet(user) {
  if (isValid(user.wh) || isOpening(user.wh)) {
    return
  }
  try {
    user.wh = OPENING
    const WALLET_KEY = 'skt'
    const WALLET_KDF = 'ARGON2I_MOD'

    printlog(`openUserWallet: Opening ${user.name} wallet`)
    user.wh = await easyindy.indyOpenWallet(user.name, WALLET_KEY, WALLET_KDF);
    let keys = await easyindy.indyCreateAndStoreMyDid(user.wh)
    user.did = keys.did, user.verkey = keys.vkey

    keys = await easyindy.indyCreateAndStoreMyDid(user.wh)
    user.pwDid = keys.did, user.pwVerkey = keys.vkey
    printlog(`openUserWallet: ${user.name} ready.`)
  } catch(err) {
    throw Error(err)
  }
}

async function openUserWalletAndOnboard(user) {
  if (isValid(user.wh) || isValid(user.agent) || isValid(user.aConn)) {
    return
  }
  if (isOpening(user.wh) || isOpening(user.agent) || isOpening(user.aConn)) {
    return
  }
  try {
    await openUserWallet(user)
    printlog(`onboardUser: Onboarding ${user.name} to Agency`)

    user.agent = OPENING
    const { agentDid, agentVerkey } =
      await vcxFlowFullOnboarding(user.wh,
        agency.send, agency.did, agency.verkey, user.did, user.verkey)
    user.agent = { did: agentDid, verkey: agentVerkey }

    user.aConn = OPENING
    const { withPairwiseDIDVerKey } =
      await vcxFlowCreateAgentConnection(user.wh, agency.send,
        user.agent.did, user.agent.verkey, user.verkey, user.pwDid, user.pwVerkey)
    user.aConn = { verkey: withPairwiseDIDVerKey }
    printlog(`onboardUser: ${user.name} ready.`)
  } catch(err) {
    throw Error(err)
  }
}

let faberMsgCount = 0
function updateFaberMetric(ee, faber) {
  faberMsgCount++
  faber.msgCount++
  ee.emit('customStat', { stat:'Faber-total', value:faberMsgCount })
  //ee.emit('customStat', { stat:faber.name, value:faber.msgCount })
}

let aliceMsg = {}
function sumAlice() {
  let sum = 0
  for (let a in aliceMsg) {
    sum += aliceMsg[a]
  }
  return sum
}
function updateAliceMetric(ee, alice, agentMsgCount) {
  aliceMsg[alice.name] = agentMsgCount
  ee.emit('customStat', { stat:'Alice-total', value:sumAlice() })
  //ee.emit('customStat', { stat:alice.name, value:agentMsgCount })
}


//
// Flow function
//

module.exports.f2a_init = async (context, ee, done) => {
  if (!agency.send) {
    const agencyClient = await buildAgencyClientNetwork(context.vars.target)
    agency.send = agencyClient.sendToAgency
    agency.encrypt = encryptForAgency
  }

  const faber = users[getFaberID()]
  const alice = users[getAliceID()]
  context.vars.faber = faber
  context.vars.alice = alice
  printlog('----------------------------------')
  printlog(`f2a_init: "${faber.name} to ${alice.name}" begins`)
  if (isValid(faber.wh) && isValid(alice.wh) && isValid(alice.agent)) {
    return done()
  }
  if (isOpening(faber.wh) && isOpening(alice.wh)) {
    printlog(`f2a_init: Waiting ${faber.name} and ${alice.name} wallets`)
    return done()
  }

  openUserWallet(faber)
  openUserWalletAndOnboard(alice)
  return done()
}

module.exports.f2a_getMsgByConns = async (context, ee, done) => {
  const alice = context.vars.alice
  if (!isValid(alice.wh) || !isValid(alice.agent)) {
    return done()
  }
  const msgs =
    await vcxFlowGetMsgsFromAgent(alice.wh, agency.send,
      alice.agent.did, alice.agent.verkey, alice.verkey, [alice.pwDid], [], [])
  if (msgs.msgsByConns[0]) {
    updateAliceMetric(ee, alice, msgs.msgsByConns[0].msgs.length)
  }
  return done()
}


//
// Post handler
//

async function setReqBody(req, context, ee, next, msgStr) {
  const faber = context.vars.faber
  const alice = context.vars.alice
  if (!isValid(faber.wh) || !isValid(alice.wh) || !isValid(alice.agent)) {
    context.vars.body = ''
    return next()
  }
  try {
    const msgTime = new Date().toISOString().replace(/T/, ' ').replace(/\..+/, 'Z')
    const msgAriesBasic = aries.buildAriesBasicMessage('123', msgStr, msgTime)
    const msgPackedForRecipient =
      await easyindy.pack(faber.wh, objectToBuffer(msgAriesBasic), alice.pwVerkey, faber.pwVerkey)
    const msgAriesFwdToRecipient =
      aries.buildAriesFwdMessage(alice.pwVerkey, JSON.parse(msgPackedForRecipient.toString('utf8')))
    const msgAnonPackedForAgentConn = await easyindy.packAsUtf8(
      faber.wh,
      objectToBuffer(msgAriesFwdToRecipient),
      alice.aConn.verkey,
      undefined // anoncrypted
    )
    context.vars.body =
      await agency.encrypt(faber.wh,
        wrapWithAgencyFwd(alice.aConn.verkey, msgAnonPackedForAgentConn), agency.verkey)
    updateFaberMetric(ee, faber)
    return next()
  } catch (err) {
    //throw Error(err)
    printlog(`f2a_setReqBody: ${faber.name} to ${alice.name}: ${err}`)
    return next()
  }
}

module.exports.f2a_setSmallReqBody = (req, context, ee, next) => {
  const faber = context.vars.faber
  const alice = context.vars.alice
  const msgStr = `${faber.name} is sending msg to ${alice.name}`
  setReqBody(req, context, ee, next, msgStr)
}

module.exports.f2a_setLargeReqBody = async (req, context, ee, next) => {
  const msgBuf = await fs.readFile(config.PostPayloadFile)
  const msgStr = msgBuf.toString()
  setReqBody(req, context, ee, next, msgStr)
}
