module.exports = {
  plugins: [
    'security'
  ],
  extends: [
    'plugin:security/recommended'
  ],
  parserOptions: {
    ecmaVersion: 2017
  },
  env: {
    es6: true
  },
  rules: {
    'security/detect-unsafe-regex': 'WARN',
    'security/detect-buffer-noassert': 'WARN',
    'security/detect-child-process': 'WARN',
    'security/detect-disable-mustache-escape': 'WARN',
    'security/detect-eval-with-expression': 'WARN',
    'security/detect-no-csrf-before-method-override': 'WARN',
    'security/detect-non-literal-fs-filename': 'WARN',
    'security/detect-non-literal-regexp': 'WARN',
    'security/detect-non-literal-require': 'WARN',
    'security/detect-object-injection': 'WARN',
    'security/detect-possible-timing-attacks': 'WARN',
    'security/detect-pseudoRandomBytes': 'WARN'
  }
}
