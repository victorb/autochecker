/* global describe, it, after, beforeEach, xit */
const chai = require('chai')
const chaiAsPromised = require('chai-as-promised')
chai.use(chaiAsPromised)

const assert = chai.assert
const fs = require('fs-extra')
const join = require('path').join
const stream = require('stream')
const core = require('../index')

const folderExists = (path) => {
  return fs.existsSync(join(__dirname, path))
}

const createMockStreamFunc = () => {
  return (image, options, callback) => {
    if (callback === undefined) {
      callback = options
    }
    const fake_stream = new stream.Readable()
    callback(docker_mock_error_value, fake_stream)
    fake_stream._read = () => {
    }
    fake_stream.emit('end')
  }
}

const PACKAGE_FILE = `{
  "name": "test_project",
  "version": "0.0.1",
  "description": "",
  "main": "index.js",
  "scripts": {
    "test": "echo "I'm gonna fail..."; exit 1"
  },
  "keywords": [],
  "license": "MIT"
}`

const writeTestProject = () => {
  fs.mkdirsSync(join(__dirname, 'test_project'))
  fs.mkdirsSync(join(__dirname, 'test_project', '.git'))
  fs.mkdirsSync(join(__dirname, 'test_project', 'node_modules'))
  fs.writeFileSync(join(__dirname, 'test_project', 'package.json'), JSON.stringify(PACKAGE_FILE, null, 2))
}

var docker_mock = null
var docker_mock_error_value = null
var docker_mock_run_statuscode = 0
beforeEach(() => {
  docker_mock_error_value = null
  docker_mock = {
    pull: createMockStreamFunc(),
    buildImage: createMockStreamFunc(),
    run: (image_name, cmd, output, callback) => {
      callback(docker_mock_error_value, {
        StatusCode: docker_mock_run_statuscode
      })
    }
  }
})
after((done) => {
  fs.remove(join(__dirname, 'tmp_test_project'), () => {
    fs.remove(join(__dirname, 'test_project'), () => {
      done()
    })
  })
})
describe('Application Core Logic', () => {
  describe('Copy application', () => {
    beforeEach(writeTestProject)
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
  describe('Pulling a image', () => {
    it('Pull an image with docker', () => {
      return assert.isFulfilled(core.pullImage(docker_mock, 'small/image', 'myversion', false))
    })
    it('Can fail while pulling image', () => {
      docker_mock_error_value = new Error('Something went wrong')
      return assert.isRejected(core.pullImage(docker_mock, 'small/image', 'myversion', false), /Something went wrong/)
    })
    xit('Logs data if wanted')
  })
  describe('Building a image', () => {
    beforeEach(writeTestProject)
    it('Builds a image from path', () => {
      return assert.isFulfilled(core.buildImage(docker_mock, join(__dirname, 'test_project'), 'my/image', false))
    })
    it('Build fails if directory does not exists', () => {
      return assert.isRejected(core.buildImage(docker_mock, join(__dirname, 'not_existing'), 'my/image', false))
    })
    it('Can fail while building image', () => {
      docker_mock_error_value = new Error('Something went wrong')
      return assert.isRejected(
        core.buildImage(docker_mock, join(__dirname, 'test_project'), 'small/image', 'myversion', false),
        /Something went wrong/
      )
    })
  })
  describe('Run a container', () => {
    it('Runs a container', () => {
      return assert.isFulfilled(core.runContainer(docker_mock, 'my/image', ['whoami'], false))
    })
    it('Tells when the command succeeded', (done) => {
      docker_mock_run_statuscode = 0
      core.runContainer(docker_mock, 'my/image', ['whoami'], false).then((res) => {
        assert.strictEqual(res.success, true)
        done()
      }).catch(done)
    })
    it('Tells when the command fails', (done) => {
      docker_mock_run_statuscode = 1
      core.runContainer(docker_mock, 'my/image', ['whoami'], false).then((res) => {
        assert.strictEqual(res.success, false)
        done()
      }).catch(done)
    })
  })
  describe('Can run all commands with runTestsForVersion', () => {
    const testRun = () => {
      return core.runTestForVersion({
        logger: () => { /* logger */ },
        docker: docker_mock,
        version: '1.1.1',
        name: 'myproject',
        test_cmd: ['whoami'],
        image_name: 'app/image:commit',
        path: join(__dirname, 'test_project'),
        dockerfile: 'FROM nodejs:$VERSION',
        base_image: 'base/image',
        verbose: false
      })
    }
    it('Success', (done) => {
      docker_mock_run_statuscode = 0
      testRun()((err, res) => {
        assert.strictEqual(res.success, true)
        done(err)
      })
    })
    it('Fail', (done) => {
      docker_mock_run_statuscode = 123
      testRun()((err, res) => {
        assert.strictEqual(res.success, false)
        done(err)
      })
    })
  })
})
