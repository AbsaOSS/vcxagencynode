const util = require('util')
const logger = require('../../logging/logger-builder')(__filename)

function isKeyspaceSetNotification (channel, message) {
  return (channel.match(/^__keyspace@0__:.*/) && message === 'set')
}

function extractRedisNotificationKey (keyspaceNotificationChannel) {
  return keyspaceNotificationChannel.slice(keyspaceNotificationChannel.indexOf(':') + 1)
}

function buildRedisAdaptor (redisClientSubscriber, redisClientRw) {
  const redisSet = util.promisify(redisClientRw.set).bind(redisClientRw)
  const redisGet = util.promisify(redisClientRw.get).bind(redisClientRw)
  const redisDel = util.promisify(redisClientRw.del).bind(redisClientRw)
  const redisSubscribe = util.promisify(redisClientSubscriber.subscribe).bind(redisClientSubscriber)
  const redisUnsubscribe = util.promisify(redisClientSubscriber.unsubscribe).bind(redisClientSubscriber)

  const registerModifiedKeyCallback = function (callback) {
    redisClientSubscriber.on('message', async function (channel, message) {
      try {
        if (isKeyspaceSetNotification(channel, message)) {
          const modifiedKey = extractRedisNotificationKey(channel)
          await callback(modifiedKey)
        } else {
          logger.warn(`Received notification, but it's not keyspace-set. Will be ignored. Channel=${channel} Message=${message}`)
        }
      } catch (err) {
        logger.error(`Callback failed to process redis event notification. ${err.message}`)
      }
    })
  }

  const subscribeKey = async (agentDid) => {
    return redisSubscribe(`__keyspace@0__:${agentDid}`)
  }

  const unsubscribeKey = async (agentDid) => {
    return redisUnsubscribe(`__keyspace@0__:${agentDid}`)
  }

  const cleanupResources = () => {
    redisClientSubscriber.quit()
    redisClientRw.quit()
  }

  const setValue = async (agentDid, value) => {
    return redisSet(agentDid, value)
  }

  const getValue = async (agentDid) => {
    return redisGet(agentDid)
  }

  const deleteValue = async (agentDid) => {
    return redisDel(agentDid)
  }

  return {
    registerModifiedKeyCallback,
    subscribeKey,
    unsubscribeKey,
    setValue,
    getValue,
    deleteValue,
    cleanupResources
  }
}

module.exports = { buildRedisAdaptor }
