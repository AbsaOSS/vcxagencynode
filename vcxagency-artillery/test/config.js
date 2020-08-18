const Config = require('./test-config.json')
;
(function validationConfig() {
  Config.MaxMessagingAliceNumber =
    Math.min(Config.AliceNumber, Config.MaxMessagingAliceNumber)
  Config.MaxMessagingFaberNumber =
    Math.min(Config.FaberNumber, Config.MaxMessagingFaberNumber)
})()

module.exports = Config

module.exports.getAliceName = (userNumber) => {
  const num = '00000' + userNumber
  return Config.TestName + '-Alice-' + num.slice(-5)  // assume 5 digit is enough
}

module.exports.getFaberName = (userNumber) => {
  const num = '00000' + userNumber
  return Config.TestName + '-Faber-' + num.slice(-5)  // assume 5 digit is enough
}
