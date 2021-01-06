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

const networks = {
  'host-docker-internal': `${__dirname}/genesis/host_docker_internal`,
  'docker': `${__dirname}/genesis/127.0.0.1`,
  'builder-net': `${__dirname}/genesis/pool_transactions_builder_genesis`
}

function getGenesisFile (networkName) {
  if (!networks[networkName]) {
    throw Error(`Couldn't resolve genesis file for network ${networkName}. Available networks: ${JSON.stringify(networks, null, 2)}`)
  }
  return networks[networkName]
}

module.exports.getGenesisFile = getGenesisFile
