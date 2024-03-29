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

const { createProxyMiddleware } = require('http-proxy-middleware')
const logger = require('../logging/logger-builder')(__filename)

module.exports = function (router, proxyPrefix, proxyTargetUrl) {
  const proxyMiddleware = createProxyMiddleware({
    target: proxyTargetUrl,
    changeOrigin: true,
    pathRewrite: {
      [`^${proxyPrefix}`]: ''
    }
  })

  const logProxy = function (req, res, next) {
    logger.debug(`Proxying request to ${req.method} ${proxyTargetUrl}`)
    next()
  }

  router.use('/', logProxy)
  router.use('/', proxyMiddleware)
}
