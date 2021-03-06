'use strict'

var setProto = Object.setPrototypeOf

/**
 *  JS CustomError implementation — The One
 *  This is the closest we can get to ES2015 `extends Error` implementation.
 *  @version 2017-01-05
 *  @author
 *      Onur Yıldırım (https://github.com/onury)
 *      Matt Browne (https://github.com/mbrowne)
 *  @see
 *      https://github.com/onury/custom-error-test
 *      http://stackoverflow.com/a/35881508/112731
 *      https://gist.github.com/mbrowne/4af54767dcb3d529648f5a8aa11d6348
 *      http://stackoverflow.com/a/41338601/112731
 *
 *  -----> https://github.com/onury/custom-error-test/blob/master/the-one/CustomError.js <------
 */
function ErrorFeatureDisabled (message) {
  var err
  if (setProto) {
    err = new Error(message)
    setProto(err, ErrorFeatureDisabled.prototype)
  } else {
    err = this
  }

  Object.defineProperty(err, 'name', {
    enumerable: false,
    writable: false,
    value: 'ErrorFeatureDisabled'
  })

  if (!setProto) {
    Object.defineProperty(err, 'message', {
      enumerable: false,
      writable: true,
      value: message
    })
    if (Error.captureStackTrace) {
      Error.captureStackTrace(err, ErrorFeatureDisabled)
    } else {
      Object.defineProperty(err, 'stack', {
        enumerable: false,
        writable: false,
        value: (new Error(message)).stack
      })
    }
  }

  return err
}

if (setProto) {
  setProto(ErrorFeatureDisabled.prototype, Error.prototype)
} else {
  ErrorFeatureDisabled.prototype = Object.create(Error.prototype, {
    constructor: { value: ErrorFeatureDisabled }
  })
}

module.exports.ErrorFeatureDisabled = ErrorFeatureDisabled
