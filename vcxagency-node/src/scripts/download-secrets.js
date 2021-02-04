const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager')
const logger = require('../logging/logger-builder')(__filename)

module.exports.fetchAwsSecrets = async function fetchAwsSecrets (appConfig) {
  for (const [key, value] of Object.entries(appConfig)) {
    if (key.match(/.*_SECRET/i)) {
      if (value) {
        logger.debug(`Secret ${key} is defined, not fetching from AWS secrets manager...`)
      } else if (appConfig.AWS_SM_KEY_PREFIX) {
        appConfig[key] = await fetchAwsSecret(key, value, appConfig.AWS_SM_KEY_PREFIX, { region: 'eu-west-1' })
      } else {
        throw Error(`Secret ${key} is left undefined, but secrets manager can't fetch its value since prefix key is not defined!`)
      }
    }
  }
}

async function fetchAwsSecret (key, value, prefix, clientConfig) {
  logger.debug(`Downloading secret for key ${key}`)

  const sm = new SecretsManagerClient(clientConfig)

  const command = new GetSecretValueCommand({
    SecretId: prefix + key.toLowerCase()
  })
  const data = await sm.send(command)

  return data.SecretString
}
