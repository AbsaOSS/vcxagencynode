const mysql = require('mysql')
const fs = require('fs')
const util = require('util')
const path = require('path')

async function createMysqlDatabase (dbName, host, port, user, password) {
  const createdbFilePath = path.join(__dirname, 'dbsetup', 'create.sql')
  const cmd = fs.readFileSync(createdbFilePath)
    .toString()
    .replace(/<wallet_db_name>/gi, dbName)
  const dbConfig = {
    host,
    port,
    user,
    password,
    multipleStatements: true
  }
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

  return dbName
}

async function assureMysqlDatabase (dbName, host, port, user, password) {
  try {
    await createMysqlDatabase(dbName, host, port, user, password)
  } catch (err) {
    if (err.code !== 'ER_DB_CREATE_EXISTS') {
      throw err
    }
  }
}

module.exports = {
  createMysqlDatabase,
  assureMysqlDatabase
}
