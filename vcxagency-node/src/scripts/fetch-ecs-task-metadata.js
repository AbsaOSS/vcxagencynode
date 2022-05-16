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

const axios = require('axios')
const logger = require('../logging/logger-builder')(__filename)

function parseEcsTaskMetadata (response) {
  let respJson
  const respType = typeof response
  if (respType === 'string') respJson = JSON.parse(response)
  else if (respType === 'object') respJson = response
  else throw Error(`Unexpected response type ${respType}: ${response}`)
  const containerId = respJson.DockerId
  const containerName = respJson.Name
  const imageName = respJson.Image
  const createdAt = respJson.CreatedAt
  const startedAt = respJson.StartedAt
  const clusterName = respJson.Labels && respJson.Labels['com.amazonaws.ecs.cluster']
  const taskArn = respJson.Labels && respJson.Labels['com.amazonaws.ecs.task-arn']
  const taskDefinitionFamily = respJson.Labels && respJson.Labels['com.amazonaws.ecs.task-definition-family']
  const taskDefinitionVersion = respJson.Labels && respJson.Labels['com.amazonaws.ecs.task-definition-version']
  if (!containerId) {
    logger.warn('Container ID not found in ECS metadata')
  }
  if (!containerName) {
    logger.warn('Container name not found in ECS metadata')
  }
  if (!imageName) {
    logger.warn('Image name not found in ECS metadata')
  }
  if (!createdAt) {
    logger.warn('Container creation time not found in ECS metadata')
  }
  if (!startedAt) {
    logger.warn('Container start time not found in ECS metadata')
  }
  if (!clusterName) {
    logger.warn('Cluster name not found in ECS metadata')
  }
  if (!taskArn) {
    logger.warn('Task ARN not found in ECS metadata')
  }
  if (!taskDefinitionFamily) {
    logger.warn('Task definition family name not found in ECS metadata')
  }
  if (!taskDefinitionVersion) {
    logger.warn('Task definition version not found in ECS metadata')
  }
  return {
    containerId,
    containerName,
    imageName,
    createdAt,
    startedAt,
    clusterName,
    taskArn,
    taskDefinitionFamily,
    taskDefinitionVersion
  }
}

async function fetchEcsTaskMetadata (ecsContainerMetadataUriV4) {
  if (!ecsContainerMetadataUriV4) {
    logger.warn('Container metadata URI was not provided, will not log ECS task metadata')
    return
  }
  try {
    const res = await axios.default.get(ecsContainerMetadataUriV4)
    if (res.status !== 200) {
      logger.warn(`Received other than 200 response status code (${res.status}) when fetching ECS task metadata, will not log ECS task metadata`)
      return
    }
    if (!res.data) {
      logger.warn('Empty response when fetching ECS task metadata, will not log ECS task metadata')
      return
    }
    return parseEcsTaskMetadata(res.data)
  } catch (err) {
    logger.warn(`Error thrown when fetching ECS task metadata: ${err}, will not log ECS task metadata`)
  }
}

module.exports.fetchEcsTaskMetadata = fetchEcsTaskMetadata
