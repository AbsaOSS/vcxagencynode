const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3')
const fs = require('fs')
const logger = require('../logging/logger-builder')(__filename)

function parseAssetPath (path) {
  const splitPath = path.split('/')
  const len = splitPath.length
  const missing = len === 0
    ? 'name'
    : len === 1
      ? 'key'
      : ''
  if (missing) {
    throw Error(`TLS enabled, but bucket ${missing} not provided`)
  } else if (len > 2) {
    throw Error('AWS S3 certificate path must be in format \'bucket_name/key\'')
  }
  return { bucketName: splitPath[0], key: splitPath[1] }
}

async function fetchAwsAsset (bucketName, key, filePath, clientConfig) {
  if (fs.existsSync(filePath)) {
    throw Error(`Attempting to download file ${filePath}, which already exists`)
  }

  logger.debug(`Downloading from bucket ${bucketName} key ${key} using client config ${JSON.stringify(clientConfig)}`)

  const s3 = new S3Client(clientConfig)

  const command = new GetObjectCommand({
    Key: key,
    Bucket: bucketName
  })
  const data = await s3.send(command)

  const writeStream = fs.createWriteStream(filePath)
  data.Body.pipe(writeStream)

  logger.debug(`Downloading of asset ${bucketName}/${key} finished`)
}

module.exports.fetchCertsFromS3 = async function fetchCertsFromS3 ({ s3CertPath, certPath, keyPath, enableTls }) {
  const reason = enableTls === 'false'
    ? 'TLS disabled'
    : fs.existsSync(certPath) && fs.existsSync(keyPath)
      ? 'Certificates already provided'
      : ''
  if (reason) {
    logger.info(`${reason}, skipping downloading certificates from S3...`)
    return
  }

  const { bucketName, key } = parseAssetPath(s3CertPath)

  logger.info('Downloading certificates')
  await fetchAwsAsset(bucketName, key + '.crt', certPath)
  await fetchAwsAsset(bucketName, key + '.key', keyPath)
}
