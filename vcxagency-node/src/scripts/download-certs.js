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

const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3')
const fs = require('fs')
const logger = require('../logging/logger-builder')(__filename)
const assert = require('assert')

async function fetchAwsAsset (bucketName, key, filePath, clientConfig = { region: 'eu-west-1' }) {
  if (filePath && fs.existsSync(filePath)) {
    throw Error(`Attempting to download file ${filePath}, which already exists`)
  }

  logger.info(`Downloading ${bucketName}/${key}`)

  const s3 = new S3Client(clientConfig)

  const command = new GetObjectCommand({
    Key: key,
    Bucket: bucketName
  })
  const data = await s3.send(command)

  const writeStream = fs.createWriteStream(filePath)
  data.Body.pipe(writeStream)

  logger.debug(`Downloading of ${bucketName}/${key} finished`)
}

async function fetchServerCertsFromS3 (appConfig) {
  if (fs.existsSync(appConfig.CERTIFICATE_PATH) && fs.existsSync(appConfig.CERTIFICATE_KEY_PATH)) {
    logger.info('TLS enabled and certificates already present, skipping downloading certificates from S3')
    return
  }
  logger.info('Downloading server TLS certificates')
  assert(appConfig.AWS_S3_BUCKET_CERT, 'S3 bucket name to download certificates from not specified')
  assert(appConfig.AWS_S3_PATH_CERT, 'Path to certificate in S3 bucket not specified')
  assert(appConfig.AWS_S3_PATH_CERT_KEY, 'Path to certificate key in S3 bucket not specified')
  await fetchAwsAsset(appConfig.AWS_S3_BUCKET_CERT, appConfig.AWS_S3_PATH_CERT, appConfig.CERTIFICATE_PATH)
  await fetchAwsAsset(appConfig.AWS_S3_BUCKET_CERT, appConfig.AWS_S3_PATH_CERT_KEY, appConfig.CERTIFICATE_KEY_PATH)
}

module.exports = {
  fetchServerCertsFromS3
}
