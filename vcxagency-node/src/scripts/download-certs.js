const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3')
const fs = require('fs')
const logger = require('../logging/logger-builder')(__filename)
const assert = require('assert')

async function fetchAwsAsset (bucketName, key, filePath) {
  if (filePath && fs.existsSync(filePath)) {
    throw Error(`Attempting to download file ${filePath}, which already exists`)
  }

  logger.debug(`Downloading from bucket ${bucketName} key ${key}`)

  const s3 = new S3Client()

  const command = new GetObjectCommand({
    Key: key,
    Bucket: bucketName
  })
  const data = await s3.send(command)

  const writeStream = fs.createWriteStream(filePath)
  data.Body.pipe(writeStream)

  logger.debug(`Downloading of asset ${bucketName}/${key} finished`)
}

module.exports.fetchCertsFromS3 = async function fetchCertsFromS3 (appConfig) {
  if (appConfig.SERVER_ENABLE_TLS === 'false') {
    logger.info('TLS disabled, skipping downloading certificates from S3...')
    return
  } else if (appConfig.CERTIFICATE_PATH && appConfig.CERTIFICATE_KEY_PATH &&
    fs.existsSync(appConfig.CERTIFICATE_PATH) && fs.existsSync(appConfig.CERTIFICATE_KEY_PATH)) {
    logger.info('TLS enabled and certificates already present, skipping downloading certificates from S3...')
    return
  }

  logger.info('Downloading certificates')
  assert(appConfig.AWS_S3_BUCKET_CERTS, 'S3 bucket name to download certificates from not specified')
  assert(appConfig.AWS_S3_PATH_CERT, 'Path to certificate in S3 bucket not specified')
  assert(appConfig.AWS_S3_PATH_CERT_KEY, 'Path to certificate key in S3 bucket not specified')
  await fetchAwsAsset(appConfig.AWS_S3_BUCKET_CERTS, appConfig.AWS_S3_PATH_CERT, appConfig.CERTIFICATE_PATH)
  await fetchAwsAsset(appConfig.AWS_S3_BUCKET_CERTS, appConfig.AWS_S3_PATH_CERT_KEY, appConfig.CERTIFICATE_KEY_PATH)
}
