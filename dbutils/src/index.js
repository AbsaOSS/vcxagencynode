const schemas = require('./db-schemas')
const migration = require('./migration')
const dbtestutils = require('./db-testutils')

module.exports = {
  ... schemas,
  ... migration,
  ... dbtestutils
}
