const mysql = require('mysql')
const util = require('util')

let logToConsole = false

async function enableConsoleLogging() {
  logToConsole = true
}

async function _runSingleCmd(dbConfig, cmd) {
  const con = mysql.createConnection(dbConfig)
  const connect = util.promisify(con.connect).bind(con)
  await connect()
  try {
    const query = util.promisify(con.query).bind(con)
    await query(cmd)
  } finally {
    const disconnect = util.promisify(con.end).bind(con)
    await disconnect()
  }
}

async function runSingleCmd(user, password, host, port, cmd, database) {
  const dbConfig = {
    host,
    port,
    user,
    password,
    database,
    multipleStatements: false
  }
  await _runSingleCmd(dbConfig, cmd)
}

async function runSingleCmdOnSchema(user, password, host, port, database, cmd) {
  const dbConfig = {
    host,
    port,
    user,
    password,
    database,
    multipleStatements: false
  }
  await _runSingleCmd(dbConfig, cmd)
}

async function dropMysqlDatabase (user, password, host, port, dbName) {
  const cmd = `DROP DATABASE ${dbName}`
  await runSingleCmd(user, password, host, port, cmd)
}

async function createMysqlDatabase (user, password, host, port, dbName) {
  const cmd = `CREATE DATABASE ${dbName}`
  await runSingleCmd(user, password, host, port, cmd)
}

async function _canConnect(dbConfig) {
  const con = mysql.createConnection(dbConfig)
  const connect = util.promisify(con.connect).bind(con)
  const disconnect = util.promisify(con.end).bind(con)
  try {
    await connect()
    return true
  } catch (err) {
    if (true) {
      console.log(err.stack)
    }
    return false
  } finally {
    try {
      await disconnect()
    } catch (err) { }
  }
}

async function canConnectToDb (user, password, host, port) {
  const dbConfig = { host, port, user, password }
  return _canConnect(dbConfig)
}

async function canConnectToDbSchema (user, password, host, port, schema) {
  const dbConfig = { host, port, user, password, database: schema }
  return _canConnect(dbConfig)
}

async function schemaExists (user, password, host, port, schema) {
  const dbConfig = { host, port, user, password, database: schema }
  return _canConnect(dbConfig)
}

async function assureMysqlDatabase (user, password, host, port, dbName) {
  try {
    await createMysqlDatabase(user, password, host, port, dbName)
  } catch (err) {
    if (err.code !== 'ER_DB_CREATE_EXISTS') {
      throw err
    } else {
      if (logToConsole) {
        console.warn(`Database ${dbName} already exists. Creation skipped.`)
      }
    }
  }
}

module.exports = {
  runSingleCmdOnSchema,
  canConnectToDb,
  canConnectToDbSchema,
  schemaExists,
  dropMysqlDatabase,
  createMysqlDatabase,
  assureMysqlDatabase,
  enableConsoleLogging,
  runSingleCmd
}
