const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3')
const fs = require('fs')
const logger = require('../logging/logger-builder')(__filename)

module.exports.fetchAwsAssets = async function fetchAwsAssets (appConfig) {
  if (appConfig.SERVER_ENABLE_TLS === 'false') {
    logger.info('TLS disable, skipping AWS assets download...')
  } else if (!appConfig.AWS_BUCKET_NAME || !appConfig.AWS_DOMAIN_NAME) {
    logger.info('AWS S3 bucket or domain name not defined, skipping AWS assets download...')
  } else {
    logger.info('Downloading S3 assets')
    await fetchAwsAsset(appConfig.AWS_BUCKET_NAME, appConfig.AWS_DOMAIN_NAME + '.crt', appConfig.CERTIFICATE_PATH, { region: 'eu-west-1' })
    await fetchAwsAsset(appConfig.AWS_BUCKET_NAME, appConfig.AWS_DOMAIN_NAME + '.key', appConfig.CERTIFICATE_KEY_PATH, { region: 'eu-west-1' })
  }
}

async function fetchAwsAsset (bucketName, key, filePath, clientConfig) {
  if (fs.existsSync(filePath)) {
    logger.info(`File ${filePath} already exists`)
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
