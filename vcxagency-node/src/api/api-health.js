const { asyncHandler } = require('./middleware')

module.exports = function (app) {
  app.get('/',
    asyncHandler(async function (req, res) {
      res.status(200).send({ success: 'true' })
    }))
}
