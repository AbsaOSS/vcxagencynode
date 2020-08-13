'use strict'

const easyindy = require('easy-indysdk')
const onboarding = require('../../src/messaging/client2agency/onboarding')
const { wrapWithAgencyFwd } = require('../../src/agency-flows')
const { encryptForAgency } = require('../common')
const config = require('../config')
const printlog = config.DEBUG ? console.log: ()=>{}

const agency = {}
agency.did = process.env.AGENCY_DID || 'VsKV7grR1BUE29mG2Fm2kX'
agency.verkey = process.env.AGENCY_VERKEY || 'Hezce2UWMZ3wUhVkh2LfKSs8nDzWwzs2Win7EzNN3YaR'
agency.encrypt = encryptForAgency

let userID = 0
let users = []
let tryCount = 0, okCount = 0, failCount = 0
;
(() => {
  let i, user
  for (i=0; i<config.AliceNumber; i++) {
    user = { name: config.getAliceName(i), testCount:0, okCount:0, failCount:0 }
    users[i] = user
  }
  for (i=0; i<config.FaberNumber; i++) {
    user = { name: config.getFaberName(i), testCount:0, okCount:0, failCount:0 }
    users[i + config.AliceNumber] = user
  }
})()


//
// Test Utility
//

function getUserID() {
  const ret = userID
  userID++
  userID %= users.length
  return ret
}

function isUserWalletValid(wh) {
  if (wh && wh!=='opening') {
    return true
  } else {
    return false
  }
}

function isUserAgentValid(agent) {
  if (agent && agent.did && agent.verkey) {
    return true
  } else {
    return false
  }
}


//
// Flow control
//

module.exports.init = (context, ee, done) => {
  const user = users[getUserID()]
  context.vars.user = user
  printlog('----------------------------------')
  printlog(`init: Test for "${user.name}" begins`)
  if (user.wh) {
    if (user.wh === 'opening') {
      printlog(`init: Waiting ${user.name} wallet`)
      return done()
    }
    //printlog(`init: ${user.name} wallet is already opened`)
    return done()
  }

  printlog(`init: Opening ${user.name} wallet`)
  user.wh = 'opening'
  const WALLET_KEY = 'skt'
  const WALLET_KDF = 'ARGON2I_MOD'
  easyindy.indyOpenWallet(user.name, WALLET_KEY, WALLET_KDF)
  .then(wh => {
    user.wh = wh
    return easyindy.indyCreateAndStoreMyDid(wh)
  })
  .then(({ did, vkey }) => {
    user.did = did
    user.verkey = vkey
    printlog(`init: ${user.name}'s wallet is opened`)
  })
  .catch(err => {
    throw Error(err)
  })
  return done()
}

module.exports.reportOnboardingResult = (context, ee, done) => {
  const user = context.vars.user
  printlog(`\nREPORT: user= ${user.name}, try=${user.testCount}, ok=${user.okCount}, fail=${user.failCount}`)
  return done()
}


//
// VCX Connect
//

module.exports.setConnMsg = (req, context, ee, next) => {
  const user = context.vars.user
  if (!isUserWalletValid(user.wh)) {
    context.vars.body = ''
    return next()
  }
  tryCount++
  user.testCount++
  ee.emit('customStat', { stat:'onboarding-try', value:tryCount })

  const objConn = JSON.stringify(onboarding.buildMsgVcxV2Connect(user.did, user.verkey))
  easyindy.packAsUtf8(user.wh, Buffer.from(objConn), agency.verkey, user.verkey)
  .then(msgConn => {
    return agency.encrypt(user.wh, wrapWithAgencyFwd(agency.did, msgConn), agency.verkey)
  })
  .then(vcxmsgConn => {
    context.vars['body'] = vcxmsgConn
    printlog(`setConnMsg: ${user.name}: OK`)
    return next()
  })
  .catch(err => {
    //throw Error(err)
    printlog(`setConnMsg: ${user.name}: ${err}`)
    return next()
  })
}

module.exports.handleConnRes = (req, res, context, ee, next) => {
  const user = context.vars.user
  if (!isUserWalletValid(user.wh) || !context.vars.body) {
    return next()
  }

  const data = JSON.parse(res.body)
  if (data.errorMsg) {
    okCount++
    user.okCount++
    ee.emit('customStat', { stat:'onboarding-ok', value:okCount })

    printlog(`handleConnRes: ${user.name}: Agency error:`, data.errorMsg)
    return next()
  }
  easyindy.unpack(user.wh, Buffer.from(JSON.stringify(data), 'utf8'))
  .then(decryptedMsg => {
    okCount++
    user.okCount++
    ee.emit('customStat', { stat:'onboarding-ok', value:okCount })

    const msgConn = JSON.parse(decryptedMsg.message)
    user.agent = {}
    user.agent.did = msgConn.withPairwiseDID
    user.agent.verkey = msgConn.withPairwiseDIDVerKey
    printlog(`handleConnRes: ${user.name}: OK: user.agent.did= ${user.agent.did}`)
    return next()
  })
  .catch(err => {
    failCount++
    user.failCount++
    ee.emit('customStat', { stat:'onboarding-fail', value:failCount })

    //throw Error(err)
    console.log(`setConnMsg: ${user.name}: ${err}`)
    return next()
  })
}


//
// VCX SignUp
//

module.exports.setSignUpMsg = (req, context, ee, next) => {
  const user = context.vars.user
  if (!isUserWalletValid(user.wh) || !isUserAgentValid(user.agent)) {
    context.vars.body = ''
    return next()
  }

  const objSignUp = JSON.stringify(onboarding.buildMsgVcxV2SignUp())
  easyindy.packAsUtf8(user.wh, Buffer.from(objSignUp), user.agent.verkey, user.verkey)
  .then(msgSignUp => {
    return agency.encrypt(user.wh, wrapWithAgencyFwd(user.agent.did, msgSignUp), agency.verkey)
  })
  .then(vcxmsgSignUp => {
    printlog(`setSignUpMsg: ${user.name}: OK`)
    context.vars.body = vcxmsgSignUp
    return next()
  })
  .catch(err => {
    //throw Error(err)
    console.log(`setConnMsg: ${user.name}: ${err}`)
    return next()
  })
}

module.exports.handleSignUpRes = (req, res, context, ee, next) => {
  const user = context.vars.user
  if (!isUserWalletValid(user.wh) || !context.vars.body) {
    return next()
  }

  let data = JSON.parse(res.body)
  if (data.errorMsg) {
    printlog(`handleSignUpRes: ${user.name}: Agency error:`, data.errorMsg)
    return next()
  }
  easyindy.unpack(user.wh, Buffer.from(JSON.stringify(data), 'utf8'))
  .then(decryptedMsg => {
    printlog(`handleSignUpRes: ${user.name}: OK`)
    return next()
  })
  .catch(err => {
    //throw Error(err)
    console.log(`setConnMsg: ${user.name}: ${err}`)
    return next()
  })
}


//
// VCX CreateAgent
//

module.exports.setCreateAgentMsg = (req, context, ee, next) => {
  const user = context.vars.user
  if (!isUserWalletValid(user.wh) || !isUserAgentValid(user.agent)) {
    context.vars.body = ''
    return next()
  }

  const objCreateAgent = JSON.stringify(onboarding.buildMsgVcxV2CreateAgent())
  easyindy.packAsUtf8(user.wh, Buffer.from(objCreateAgent), user.agent.verkey, user.verkey)
  .then(msgCreateAgent => {
    return agency.encrypt(user.wh, wrapWithAgencyFwd(user.agent.did, msgCreateAgent), agency.verkey)
  })
  .then(vcxmsgCreateAgent => {
    context.vars.body = vcxmsgCreateAgent
    printlog(`setCreateAgentMsg: ${user.name}: OK`)
    return next()
  })
  .catch(err => {
    //throw Error(err)
    printlog(`setConnMsg: ${user.name}: ${err}`)
    return next()
  })
}

module.exports.handleCreateAgentRes = (req, res, context, ee, next) => {
  const user = context.vars.user
  if (!isUserWalletValid(user.wh) || !context.vars.body) {
    return next()
  }

  const data = JSON.parse(res.body)
  if (data.errorMsg) {
    printlog(`handleCreateAgentRes: ${user.name}: Agency error:`, data.errorMsg)
    return next()
  }
  easyindy.unpack(user.wh, Buffer.from(JSON.stringify(data), 'utf8'))
  .then(decryptedMsg => {
    const msgAgentCreated = JSON.parse(decryptedMsg.message)
    user.agent.did = msgAgentCreated.withPairwiseDID
    user.agent.verkey = msgAgentCreated.withPairwiseDIDVerKey
    printlog(`handleCreateAgentRes: ${user.name}: OK: user.agent.did= ${user.agent.did}`)
    return next()
  })
  .catch(err => {
    //throw Error(err)
    console.log(`setConnMsg: ${user.name}: ${err}`)
    return next()
  })
}
