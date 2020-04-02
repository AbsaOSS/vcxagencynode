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

async function createStorageMemory () {
  let storage = {}

  async function set (id, data) {
    storage[id] = data
  }

  async function get (id) {
    return storage[id]
  }

  async function values () {
    return Object.values(storage)
  }

  async function keys () {
    return Object.keys(storage)
  }

  async function hasKey (key) {
    return Object.keys(storage).includes(key)
  }

  return {
    set,
    get,
    values,
    keys,
    hasKey
  }
}

module.exports.createStorageMemory = createStorageMemory
