/* global describe, it, afterEach */
const chai = require('chai')
const chaiAsPromised = require('chai-as-promised')
chai.use(chaiAsPromised)

const assert = chai.assert
const fs = require('fs-extra')
const join = require('path').join
const core = require('../core')

const folderExists = (path) => {
  return fs.existsSync(join(__dirname, path))
}

describe('Application Core Logic', () => {
  describe('Copy application', () => {
    afterEach(() => {
      fs.removeSync(join(__dirname, 'tmp_test_project'))
    })
    it('Can copy directory', (done) => {
      // Arrange
      var folder_exists = folderExists('test_project')
      var git_folder_exists = folderExists('test_project/.git')
      var node_modules_folder_exists = folderExists('test_project/node_modules')
      assert.strictEqual(folder_exists, true)
      assert.strictEqual(git_folder_exists, true)
      assert.strictEqual(node_modules_folder_exists, true)

      // Act
      core.copyApplicationToTempLocation(
          join(__dirname, 'test_project'),
          join(__dirname, 'tmp_test_project')
      ).then(() => {
        folder_exists = folderExists('tmp_test_project')
        git_folder_exists = folderExists('tmp_test_project/.git')
        node_modules_folder_exists = folderExists('tmp_test_project/node_modules')

        assert.strictEqual(folder_exists, true)
        assert.strictEqual(git_folder_exists, false)
        assert.strictEqual(node_modules_folder_exists, false)
        done()
      }).catch(done)
    })
    it('fails if app directory doesnt exists', () => {
      const promise = core.copyApplicationToTempLocation('/holabandola/', join(__dirname, 'tmp_test_project'))
      return assert.isRejected(promise, /ENOENT: no such file or directory/, 'Promise was fulfilled')
    })
  })
})
