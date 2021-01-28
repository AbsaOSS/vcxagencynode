const redis = require('redis')
const logger = require('../../logging/logger-builder')(__filename)

module.exports.buildRedisClients = function buildRedisClients (redisUrl) {
  const redisClientSubscriber = redis.createClient(redisUrl)
  const redisClientRw = redis.createClient(redisUrl)

  redisClientRw.on('error', function (err) {
    logger.error(`Redis rw-client encountered error: ${err}`)
  })
  redisClientSubscriber.on('error', function (err) {
    logger.error(`Redis subscription-client encountered error: ${err}`)
  })

  redisClientRw.on('end', () => {
    console.log('Redis rw-client disconnected')
  })
  redisClientSubscriber.on('end', () => {
    console.log('Redis subscription-client disconnected')
  })

  redisClientRw.on('reconnecting', () => {
    console.log('Redis rw-client reconnecting')
  })

  redisClientSubscriber.on('reconnecting', () => {
    console.log('Redis subscription-client reconnecting')
  })

  redisClientRw.on('connect', function () {
    logger.info('Redis rw-client connected.')
  })
  redisClientSubscriber.on('connect', function () {
    logger.info('Redis subscription-client connected.')
  })

  redisClientSubscriber.on('subscribe', function (channel, _count) {
    logger.info(`Subscribed on channel ${channel}.`)
  })

  redisClientSubscriber.on('unsubscribe', function (channel, _count) {
    logger.info(`Unsubscribed on channel ${channel}.`)
  })

  return {
    redisClientSubscriber,
    redisClientRw
  }
}
