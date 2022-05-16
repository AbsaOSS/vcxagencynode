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

const path = require('path')
const dotenv = require('dotenv')
const fs = require('fs')
const assert = require('assert')

const appConfigName = process.env.APP_CONFIG
if (appConfigName) {
  const pathToConfig = path.resolve(__dirname, `../../config/${appConfigName}.env`)
  assert(fs.existsSync(pathToConfig), `File ${pathToConfig} not found.`)
  console.log(`App configuration will be loaded from ${pathToConfig}.`)
  dotenv.config({ path: pathToConfig })
} else {
  console.log('App configuration will be loaded from supplied environment variables.')
}

function loadEnvVariables (envVariables) {
  const inputConfig = {}
  for (const envName of envVariables) {
    inputConfig[envName] = process.env[envName]
  }
  return inputConfig
}

module.exports = {
  loadEnvVariables
}
