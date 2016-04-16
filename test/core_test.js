/* global describe, it, afterEach, beforeEach */
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

const PACKAGE_FILE = `{
  "name": "test_project",
  "version": "0.0.1",
  "description": "",
  "main": "index.js",
  "scripts": {
    "test": "echo \"I'm gonna fail...\"; exit 1"
  },
  "keywords": [],
  "license": "MIT"
}`

describe('Application Core Logic', () => {
  beforeEach(() => {
    // Create a example project
    fs.mkdirsSync(join(__dirname, 'test_project'))
    fs.writeFileSync(join(__dirname, 'test_project/package.json'), JSON.stringify(PACKAGE_FILE, null, 2))
    fs.mkdirsSync(join(__dirname, 'test_project/.git'))
    fs.mkdirsSync(join(__dirname, 'test_project/node_modules'))
  })
  afterEach(() => {
    fs.removeSync(join(__dirname, 'tmp_test_project'))
    fs.removeSync(join(__dirname, 'test_project'))
  })
  describe('Copy application', () => {
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
      return assert.isRejected(promise, /ENOENT: no such file or directory/)
    })
  })
  describe('Write application Dockerfile', () => {
    it('Can write Dockerfile file to disk', (done) => {
      core.writeApplicationDockerfile(join(__dirname, 'test_project'), 'myversion', 'FROM dockerfile:$VERSION').then(() => {
        const contentsOfFile = fs.readFileSync(join(__dirname, 'test_project/Dockerfile'))
        assert.strictEqual(contentsOfFile.toString(), 'FROM dockerfile:myversion')
        done()
      }).catch(done)
    })
    it('Fails if directory doesnt exists already', () => {
      const promise = core.writeApplicationDockerfile('/holabandola', 'myversion', 'FROM dockerfile:$VERSION')
      return assert.isRejected(promise, /Directory \"\/holabandola\" did not exist/)
    })
    it('Fails if Dockerfile doesnt contain $VERSION string', () => {
      const promise = core.writeApplicationDockerfile(join(__dirname, 'test_project'), 'myversion', 'FROM dockerfile:$DOCKER')
      return assert.isRejected(promise, /Dockerfile did not contain \$VERSION/)
    })
  })
})
