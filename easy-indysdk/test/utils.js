const {
  indyBuildMysqlStorageCredentials,
  indyBuildMysqlStorageConfig,
  createMysqlDatabase
} = require('../src')
const uuid = require('uuid')

async function testsetupWalletStorage (storageType, storageHost, storagePort) {
  const testMode = 'mysql'
  const dbName = `test_wallet_${uuid.v4()}`.replace(/-/gi, '_')
  const host = 'localhost'
  const port = 3306
  const user = 'root'
  const password = 'mysecretpassword'
  await createMysqlDatabase(dbName, host, port, user, password)
  const storageConfig = indyBuildMysqlStorageConfig(storageHost, storageHost, storagePort, dbName, 50)
  const storageCredentials = indyBuildMysqlStorageCredentials(user, password)
  return {
    testMode,
    storageConfig,
    storageCredentials
  }
}

module.exports = {
  testsetupWalletStorage
}
