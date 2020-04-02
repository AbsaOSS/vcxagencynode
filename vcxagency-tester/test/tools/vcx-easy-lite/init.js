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

const { shutdownVcx, initRustAPI, initVcxWithConfig } = require('node-vcx-wrapper')
const ffi = require('ffi')
const os = require('os')

const extension = { darwin: '.dylib', linux: '.so', win32: '.dll' }
const libPath = { darwin: '/usr/local/lib/', linux: '/usr/lib/', win32: 'c:\\windows\\system32\\' }

async function initLibNullPay () {
  const platform = os.platform()
  const postfix = extension[platform.toLowerCase()] || extension.linux
  const libDir = libPath[platform.toLowerCase()] || libPath.linux
  const library = `libnullpay${postfix}`
  const pathToLibrary = `${libDir}${library}`
  const myffi = ffi.Library(pathToLibrary, { nullpay_init: ['void', []] })
  await myffi.nullpay_init()
}

async function initRustApiAndLogger (logLevel) {
  const rustApi = initRustAPI()
  await rustApi.vcx_set_default_logger(logLevel)
}

function generateUnsafeIndyCall (shutdownVcx, initVcx, logger) {
  async function unsafeLibindyCall (callable) {
    await shutdownVcx()
    const result = await callable()
    await initVcx()

    return result
  }
  return unsafeLibindyCall
}

async function basicVcxInit (logLevel) {
  await initLibNullPay()
  await initRustApiAndLogger(logLevel)
}

async function createVcxControlMethods (agentProvision, logger) {
  const initVcxCallable = async () => {
    try {
      const result = await initVcxWithConfig(JSON.stringify(agentProvision))
      return result
    } catch (err) {
      throw Error(`Error occurred while trying to init VCX with an existing agent provision: ${JSON.stringify(agentProvision)}. Erro Message: ${err.message} Stack: ${err.stack}`)
    }
  }
  const shutdownVcxCallable = async () => {
    return shutdownVcx(false)
  }
  return { shutdownVcxCallable, initVcxCallable }
}

async function initVcxAgentClient (agentProvision, logger) {
  const { shutdownVcxCallable, initVcxCallable } = await createVcxControlMethods(agentProvision, logger)
  await initVcxCallable()
  const callLibindyCodeUnsafely = generateUnsafeIndyCall(shutdownVcxCallable, initVcxCallable, logger)
  return { shutdownVcxCallable, initVcxCallable, callLibindyCodeUnsafely }
}

module.exports.basicVcxInit = basicVcxInit
module.exports.initVcxAgentClient = initVcxAgentClient
