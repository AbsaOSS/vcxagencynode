
const winston = require('winston')
const path = require('path')

const prettyFormatter = winston.format.combine(
  winston.format.printf(
    info => `${info.filename} [${info.level}]: ${info.message}`
  )
)

const mainLoggerName = 'mainlogger'
const consoleLogsLevel = 'debug'

winston.loggers.add(
  mainLoggerName,
  {
    transports: [
      new winston.transports.Console({
        level: consoleLogsLevel,
        format: winston.format.combine(
          winston.format.colorize({ all: true }),
          prettyFormatter
        )
      })
    ]
  })

module.exports = function (fullPath) {
  return winston.loggers.get(mainLoggerName).child({
    filename: path.basename(fullPath, path.extname(fullPath))
  })
}
