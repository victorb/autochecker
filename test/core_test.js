/* global describe, it, after, beforeEach, xit */
const chai = require('chai')
const chaiAsPromised = require('chai-as-promised')
chai.use(chaiAsPromised)

const assert = chai.assert
const fs = require('fs-extra')
const join = require('path').join
const stream = require('stream')
const core = require('../index')

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

var docker_mock_error_value = null
var docker_mock_run_statuscode = 0
const createDockerMock = () => {
  return {
    pull: createMockStreamFunc(),
    buildImage: createMockStreamFunc(),
    run: (image_name, cmd, output, callback) => {
      callback(docker_mock_error_value, {
        StatusCode: docker_mock_run_statuscode
      })
    }
  }
}
beforeEach(() => {
  docker_mock_error_value = null
})
after((done) => {
  fs.remove(join(__dirname, 'tmp_test_project'), () => {
    fs.remove(join(__dirname, 'test_project'), () => {
      done()
    })
  })
})
describe('Application Core Logic', () => {
  describe('Pulling a image', () => {
    const pull_opts = {
      docker: createDockerMock(),
      base_image: 'small/image',
      version: 'myversion',
      verbose: false
    }
    it('Pull an image with docker', () => {
      return assert.isFulfilled(core.pullImage(pull_opts))
    })
    it('Can fail while pulling image', () => {
      docker_mock_error_value = new Error('Something went wrong')
      return assert.isRejected(core.pullImage(pull_opts), /Something went wrong/)
    })
    xit('Logs data if wanted')
  })
  describe('Building a image', () => {
    const build_opts = {
      docker: createDockerMock(),
      path: join(__dirname, 'test_project'),
      image_name: 'my/image',
      dockerfile: 'dockerfile',
      verbose: false
    }
    beforeEach(writeTestProject)
    it('Builds a image from path', () => {
      return assert.isFulfilled(core.buildImage(build_opts))
    })
    it('Build fails if directory does not exists', () => {
      build_opts.path = '/somemadeuppath/'
      const promise = assert.isRejected(core.buildImage(build_opts))
      build_opts.path = join(__dirname, 'test_project')
      return promise
    })
    it('Can fail while building image', () => {
      docker_mock_error_value = new Error('Something went wrong')
      return assert.isRejected(
        core.buildImage(build_opts),
        /Something went wrong/
      )
    })
  })
  describe('Run a container', () => {
    const run_opts = {
      docker: createDockerMock(),
      image_name: 'my/image',
      test_cmd: ['whoami'],
      verbose: false
    }
    it('Runs a container', () => {
      return assert.isFulfilled(core.runContainer(run_opts))
    })
    it('Tells when the command succeeded', (done) => {
      docker_mock_run_statuscode = 0
      core.runContainer(run_opts).then((res) => {
        assert.strictEqual(res.success, true)
        done()
      }).catch(done)
    })
    it('Tells when the command fails', (done) => {
      docker_mock_run_statuscode = 1
      core.runContainer(run_opts).then((res) => {
        assert.strictEqual(res.success, false)
        done()
      }).catch(done)
    })
  })
  describe('Can run all commands with runTestsForVersion', () => {
    const testRun = () => {
      return core.runTestForVersion({
        logger: () => { /* logger */ },
        docker: createDockerMock(),
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
