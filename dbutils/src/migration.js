// first require the package
const DBMigrate = require('db-migrate');
const path = require('path')

async function migrateSchemaWallet(user, password, host, port, database) {
  process.env['MYSQL_USER'] = user
  process.env['MYSQL_PASSWORD'] = password
  process.env['MYSQL_HOST'] = host
  process.env['MYSQL_PORT'] = port
  process.env['MYSQL_DATABASE'] = database
  const options = { cwd: path.join(__dirname, '..') }   // making sure we are db-migrate runs relatively to dbutils dir
  const dbmigrate = DBMigrate.getInstance(true, options);
  await dbmigrate.setConfigParam('migrations-dir', path.join(__dirname, '..', 'migrations_scheme_wallets'))
  // await dbmigrate.setConfigParam('config', '/foo/bar/foobar.json')
  // await dbmigrate.setConfigParam('env', 'prod') // todo: doesn't work
  return dbmigrate.up( 'foo') // what is "specficiation" param?
}

async function migrateSchemaData(user, password, host, port, database) {
  process.env['MYSQL_USER'] = user
  process.env['MYSQL_PASSWORD'] = password
  process.env['MYSQL_HOST'] = host
  process.env['MYSQL_PORT'] = port
  process.env['MYSQL_DATABASE'] = database
  const options = { cwd: path.join(__dirname, '..') }   // making sure we are db-migrate runs relatively to dbutils dir
  const dbmigrate = DBMigrate.getInstance(true, options);
  await dbmigrate.setConfigParam('migrations-dir', path.join(__dirname, '..', 'migrations_scheme_application'))
  // await dbmigrate.setConfigParam('config', '/foo/bar/foobar.json')
  return dbmigrate.up( 'foo')
}

module.exports = {
  migrateSchemaWallet,
  migrateSchemaData
}
