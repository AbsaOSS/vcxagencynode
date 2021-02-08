const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3')
const fs = require('fs')
const logger = require('../logging/logger-builder')(__filename)

module.exports.fetchAwsAssets = async function fetchAwsAssets (appConfig) {
  if (appConfig.SERVER_ENABLE_TLS === 'false') {
    logger.info('TLS disabled, skipping AWS assets download...')
    return
  }

  const certPath = appConfig.CERTIFICATE_PATH
  const keyPath = appConfig.CERTIFICATE_KEY_PATH
  const isCertAvailable = (appConfig.AWS_BUCKET_NAME && appConfig.AWS_DOMAIN_NAME) || (fs.existsSync(certPath) && fs.existsSync(keyPath))

  if (!isCertAvailable) {
    throw Error(`TLS enabled, but AWS S3 bucket or domain name not defined, or no certificate already found on path ${certPath} or no key found on path ${keyPath}`)
  }

  logger.info('Downloading S3 assets')
  await fetchAwsAsset(appConfig.AWS_BUCKET_NAME, appConfig.AWS_DOMAIN_NAME + '.crt', certPath)
  await fetchAwsAsset(appConfig.AWS_BUCKET_NAME, appConfig.AWS_DOMAIN_NAME + '.key', keyPath)
}

async function fetchAwsAsset (bucketName, key, filePath, clientConfig = { region: 'eu-west-1' }) {
  if (fs.existsSync(filePath)) {
    logger.info(`File ${filePath} already exists, skipping download`)
    return
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
