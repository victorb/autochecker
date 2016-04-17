#! /usr/bin/env node
const os = require('os')
const readline = require('readline')
const url = require('url')
const join = require('path').join
const stream = require('stream')

// External
const Docker = require('dockerode')
const fs = require('fs-extra')
const async = require('async')
const colors = require('colors/safe')
const git = require('git-rev-sync')

const logGreen = (msg) => console.log(colors.green(msg))
const logRed = (msg) => console.log(colors.red(msg))
const clearScreen = (from) => {
  if (from === undefined) {
    from = 0
  }
  readline.cursorTo(process.stdout, 0, from)
  readline.clearScreenDown(process.stdout)
}
const coloredStdout = new stream.Writable({
  write: (chunk, encoding, next) => {
    process.stdout.write(colors.cyan(chunk.toString()))
    next()
  }
})

if (process.env.DOCKER_HOST === undefined) {
  logRed('environment variable DOCKER_HOST looks empty')
  console.log('Should be similar to this: "tcp://192.168.99.100:2376"')
  console.log('If you are using docker-machine, running "eval $(docker-machine env default)" should fix this')
  process.exit(1)
}

// CONFIG
const getDockerTemplate = () => {
  const dockerTemplate = join(process.cwd(), 'DockerTemplate')
  if (fs.existsSync(dockerTemplate)) {
    return fs.readFileSync(dockerTemplate, 'utf8')
  }
  const DEFAULT_DOCKER_TEMPLATE = `FROM mhart/alpine-node:$VERSION
RUN mkdir -p /usr/src/app
WORKDIR /usr/src/app
COPY package.json .
RUN npm install
COPY . .
`
  return DEFAULT_DOCKER_TEMPLATE
}

const DOCKER_PROTOCOL = 'https'
const parsed_url = url.parse(process.env.DOCKER_HOST)
const DOCKER_HOST = parsed_url.hostname
const DOCKER_PORT = parsed_url.port
const CERT_PATH = process.env.DOCKER_CERT_PATH
const DOCKERFILE_TEMPLATE = getDockerTemplate()

const DIRECTORY_TO_TEST = process.cwd()
const TEST_COMMAND = ['npm', 'test']
const BASE_IMAGE = 'mhart/alpine-node'
const PROJECT_NAME = require(DIRECTORY_TO_TEST + '/package.json').name
const GIT_COMMIT = git.long()
const IMAGE_NAME = `${PROJECT_NAME}_$VERSION:${GIT_COMMIT}`
const DOCKER_CONFIG = {
  protocol: DOCKER_PROTOCOL,
  host: DOCKER_HOST,
  port: DOCKER_PORT,
  ca: fs.readFileSync(join(CERT_PATH, 'ca.pem')),
  cert: fs.readFileSync(join(CERT_PATH, 'cert.pem')),
  key: fs.readFileSync(join(CERT_PATH, 'key.pem'))
}
const TMP_DIR = os.tmpdir()
// TODO implement log levels...
// const LOG_LEVEL = 'default'
// END CONFIG

// Initialize docker
const docker = new Docker(DOCKER_CONFIG)

// Setup logging
var linesToLog = {}
const createLogger = (line_id, single_view) => {
  return (msg, color) => {
    if (color === undefined) {
      color = (str) => str
    }
    if (single_view) {
      console.log(color(msg))
    } else {
      clearScreen(1)
      linesToLog[line_id] = {msg, color}
      Object.keys(linesToLog).forEach((line, index) => {
        const lineToLog = linesToLog[line].msg
        const colorToLog = linesToLog[line].color
        readline.cursorTo(process.stdout, 0, index + 1)
        process.stdout.write(colorToLog(line + '\t- ' + lineToLog + '\n'))
      })
    }
  }
}
const createErrorHandler = (version, show_output, callback) => {
  return (step, err) => {
    if (err) {
      if (show_output) {
        logRed('Something went wrong in ' + step)
      } else {
        logRed(version + '\t | Something went wrong in ' + step)
      }
      callback(err, 1)
    }
  }
}

// Main logic
const core = require('./core')
const copyApplicationToTempLocation = core.copyApplicationToTempLocation
const writeApplicationDockerfile = core.writeApplicationDockerfile
const pullBaseImage = core.pullImage
const buildImage = core.buildImage
const runContainer = (image_name, test_cmd, show_output) => {
  return new Promise((resolve) => {
    const outputter = show_output ? coloredStdout : null
    docker.run(image_name, test_cmd, outputter, (err, data) => {
      resolve({err, data})
    })
  })
}

// const executionOrders = [
//   copyApplicationToTempLocation,
//   writeApplicationDockerfile,
//   pullBaseImage,
//   buildImage,
//   runContainer
// ]
//
// executeOrders(executeOrders).then((test_exit_code) => {
//   callback(null, {exit_code: test_exit_code, version})
// })

// TODO fix callback hell
const runTestForVersion = (version, show_output) => {
  return (callback) => {
    const logger = createLogger(version, show_output)
    const handleErr = createErrorHandler(version, show_output, callback)

    const new_directory = `${TMP_DIR}/autochecker_${PROJECT_NAME}_${version}`
    logger('Copying files', colors.yellow)
    copyApplicationToTempLocation(DIRECTORY_TO_TEST, new_directory).then((err) => {
      handleErr('copying files', err)
      logger('Writing Dockerfile', colors.yellow)
      writeApplicationDockerfile(new_directory, version, DOCKERFILE_TEMPLATE).then((err) => {
        handleErr('writing Dockerfile', err)
        logger('Pulling base image', colors.yellow)
        pullBaseImage(docker, BASE_IMAGE, version, show_output).then((err) => {
          handleErr('pulling base image', err)
          logger('Building image', colors.yellow)
          const version_image_name = IMAGE_NAME.replace('$VERSION', version)
          buildImage(docker, new_directory, version_image_name, show_output).then((err) => {
            handleErr('building image', err)
            logger('Running application tests', colors.yellow)
            runContainer(version_image_name, TEST_COMMAND, show_output).then((res) => {
              const err = res.err
              const data = res.data
              handleErr('running application tests', err)
              // TODO implement proper cleanup
              // fs.remove(new_directory)
              if (show_output) {
                console.log('===========================')
              }
              logger('Tests? ' + (data.StatusCode === 0 ? '✅' : '❌'))
              callback(null, {statusCode: data.StatusCode, version: version})
            })
          })
        })
      })
    })
  }
}

// From https://hub.docker.com/r/mhart/alpine-node/tags/
// const possible_versions = ['0.10', '0.12', '4.0', '5.0']
// TODO read this automatically from package.json.engines
const default_versions_to_test = [
  '0.10.41',
  '0.10.42',
  '0.10.43',
  '0.10.44',
  '0.12.9',
  '0.12.10',
  '0.12.11',
  '0.12.12',
  '0.12.13',
  '4.2.4',
  '4.2.5',
  '4.2.6',
  '4.3.0',
  '4.3.1',
  '4.3.2',
  '4.4.0',
  '4.4.1',
  '4.4.2',
  '5.1.1',
  '5.2.0',
  '5.3.0',
  '5.4.0',
  '5.4.1',
  '5.5.0',
  '5.6.0',
  '5.7.0',
  '5.7.1',
  '5.8.0',
  '5.9.0',
  '5.9.1',
  '5.10.0',
  '5.10.1'
]

const testVersions = (versions) => {
  console.log('autochecker', 'Running tests in ' + versions.length + ' different NodeJS versions')
  async.parallelLimit(versions, process.env.TEST_LIMIT || os.cpus().length, (err, results) => {
    if (err) {
      logRed('Something went wrong in running tests...')
      throw new Error(err)
    }
    var any_errors = false
    var successes = results.filter((result) => result.statusCode === 0).length
    var failures = results.filter((result) => result.statusCode !== 0).length
    console.log()
    console.log('== Results (Success/Fail ' + successes + '/' + failures + ') ==')
    results.forEach((result) => {
      if (result.statusCode !== 0) {
        // TODO Also print out the errors themselves
        logRed('The tests did not pass on version ' + result.version)
        any_errors = true
      } else {
        logGreen('The tests did pass on version ' + result.version)
      }
    })
    if (any_errors) {
      process.exit(1)
    } else {
      process.exit(0)
    }
  })
}

if (process.argv[2] === 'ls') {
  console.log('Available versions:')
  console.log(default_versions_to_test)
  process.exit(0)
}

// Start testing everything
// TODO extract this into cli.js and make proper
if (process.argv[2] === undefined) {
  clearScreen()
  testVersions(default_versions_to_test.map((version) => runTestForVersion(version, false)))
} else {
  const to_test = process.argv.slice(2)
  if (to_test.length > 1) {
    clearScreen()
    testVersions(to_test.map((version) => runTestForVersion(version, false)))
  } else {
    console.log(colors.green('## Running tests in version ' + colors.blue(to_test[0]) + ' only'))
    runTestForVersion(to_test[0], true)((err, result) => {
      if (err) {
        console.log(colors.red(err))
        process.exit(1)
      }
      console.log()
      console.log('== Results ==')
      if (result.statusCode !== 0) {
        logRed('The tests did not pass on version ' + result.version)
        process.exit(1)
      } else {
        logGreen('The tests did pass on version ' + result.version)
        process.exit(0)
      }
    })
  }
}
