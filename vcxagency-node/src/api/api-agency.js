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

const { asyncHandler } = require('./middleware')
const logger = require('../logging/logger-builder')(__filename)
const bodyParser = require('body-parser')
const util = require('util')
const validate = require('express-validation')
const Joi = require('joi')

module.exports = function (app, forwardAgent, resolver, maxRequestSizeKb) {
  const options = {
    inflate: true,
    limit: `${maxRequestSizeKb}kb`,
    type: '*/*'
  }

  app.post('/agency/msg',
    bodyParser.raw(options),
    asyncHandler(async function (req, res) {
      logger.info(`POST /agency/msg`)
      logger.silly(`req = ${util.inspect(req)}`)
      const responseData = await forwardAgent.handleIncomingMessage(req.body)
      res.set('Content-Type', 'application/ssi-agent-wire')
      res.status(200).send(responseData)
    }))

  app.get('/agency',
    bodyParser.json(),
    asyncHandler(async function (req, res) {
      logger.info(`GET /agency`)
      const { did, verkey } = forwardAgent.getForwadAgentInfo()
      res.status(200).send({ DID: did, 'verKey': verkey })
    }))

  app.post('/agent/:agentDid',
    bodyParser.json(),
    validate(
      {
        params: {
          agentDid: Joi.string().required()
        },
        body: {
          webhookUrl: Joi.string().required()
        }
      }
    ),
    asyncHandler(async function (req, res) {
      logger.info(`POST /agent/:agentDid`)
      const { agentDid } = req.params
      const { webhookUrl } = req.body
      logger.info(`Updating webhook url to ${webhookUrl} for agent ${agentDid}`)
      const agentAo = await resolver.resolveEntityAO(agentDid)
      await agentAo.setWebhook(webhookUrl)
      res.status(200).send()
    }))
}
