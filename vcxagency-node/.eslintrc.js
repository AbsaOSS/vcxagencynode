module.exports = {
  "plugins": [
    "security"
  ],
  "extends": [
    "plugin:security/recommended"
  ],
  "parserOptions": {
    "ecmaVersion": 2017
  },
  "env": {
    "es6": true
  },
  rules: {
    "security/detect-unsafe-regex": "ERROR",
    "security/detect-buffer-noassert": "ERROR",
    "security/detect-child-process": "ERROR",
    "security/detect-disable-mustache-escape": "ERROR",
    "security/detect-eval-with-expression": "ERROR",
    "security/detect-no-csrf-before-method-override": "ERROR",
    "security/detect-non-literal-fs-filename": "ERROR",
    "security/detect-non-literal-regexp": "ERROR",
    "security/detect-non-literal-require": "ERROR",
    "security/detect-object-injection": "ERROR",
    "security/detect-possible-timing-attacks": "ERROR",
    "security/detect-pseudoRandomBytes": "ERROR"
  }
}
