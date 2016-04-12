const assert = require('assert')

const test = (version) => {
  console.log('Testing version ' + version)
  assert.strictEqual(true, true)
}

test(process.version)
