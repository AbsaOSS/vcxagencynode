const {
  indyBuildMysqlStorageCredentials,
  indyBuildMysqlStorageConfig,
  createMysqlDatabase,
  indyLoadPostgresPlugin,
  indyBuildPostgresStorageConfig,
  indyBuildPostgresCredentials
} = require('../src')
const uuid = require('uuid')

async function testsetupWalletStorage (storageType, storageHost, storagePort) {
  let testMode
  let storageConfig
  let storageCredentials
  if (storageType === 'postgres_storage') {
    const pgStrategy = 'MultiWalletSingleTableSharedPool'
    testMode = `${storageType}-${pgStrategy}`
    storageConfig = indyBuildPostgresStorageConfig(`${storageHost}:${storagePort}`, 90, 30, pgStrategy)
    storageCredentials = indyBuildPostgresCredentials('postgres', 'mysecretpassword', 'postgres', 'mysecretpassword')
    await indyLoadPostgresPlugin(storageConfig, storageCredentials)
  } else if (storageType === 'mysql') {
    testMode = 'mysql'
    const dbName = `test_wallet_${uuid.v4()}`.replace(/-/gi, '_')
    const host = 'localhost'
    const port = 3306
    const user = 'root'
    const password = 'mysecretpassword'
    await createMysqlDatabase(dbName, host, port, user, password)
    storageConfig = indyBuildMysqlStorageConfig(storageHost, storageHost, storagePort, dbName, 50)
    storageCredentials = indyBuildMysqlStorageCredentials(user, password)
  } else {
    testMode = `${storageType}`
    storageConfig = null
    storageCredentials = null
  }
  return {
    testMode,
    storageConfig,
    storageCredentials
  }
}

module.exports = {
  testsetupWalletStorage
}
