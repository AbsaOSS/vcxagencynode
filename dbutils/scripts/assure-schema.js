const { assureMysqlDatabase } = require('..')

const MYSQL_USER = process.env.MYSQL_USER || 'root'
const MYSQL_PASSWORD = process.env.MYSQL_PASSWORD || 'mysecretpassword'
const MYSQL_HOST = process.env.MYSQL_HOST || 'localhost'
const MYSQL_PORT = process.env.MYSQL_PORT || 3306
const MYSQL_DATABASE = process.env.MYSQL_DATABASE

if (!MYSQL_DATABASE) {
  throw Error("Value of env variable MYSQL_DATABASE was not specified.")
}

assureMysqlDatabase(MYSQL_USER, MYSQL_PASSWORD, MYSQL_HOST, MYSQL_PORT, MYSQL_DATABASE)
  .then(_ => {
    console.log(`Success. Database schema "${MYSQL_DATABASE}" is present.`)
  })
  .catch(err => {
    console.error(`Error creating schema "${MYSQL_DATABASE}". ${err.stack}`)
  })
