#! /usr/bin/env node
const os = require('os')
const readline = require('readline')
const url = require('url')
const path = require('path')
const join = require('path').join

// External
const Docker = require('dockerode')
const fs = require('fs-extra')
const async = require('async')
const colors = require('colors/safe')
const git = require('git-rev-sync')

// Main logic
const core = require('./index')

const logGreen = (msg) => console.log(colors.green(msg))
const logRed = (msg) => console.log(colors.red(msg))
const clearScreen = (from) => {
  if (from === undefined) {
    from = 0
  }
  readline.cursorTo(process.stdout, 0, from)
  readline.clearScreenDown(process.stdout)
}

var use_docker_socket = true
const docker_host = process.env.DOCKER_HOST
const docker_socket = '/var/run/docker.sock'

if (!fs.existsSync(docker_socket)) {
  use_docker_socket = false
}

if (!docker_host && !use_docker_socket) {
  logRed('environment variable DOCKER_HOST looks empty and no socket file found at ' + docker_socket)
  console.log('DOCKER_HOST should be similar to this: "tcp://192.168.99.100:2376"')
  console.log('If you are using docker-machine, running "eval $(docker-machine env default)" should fix this')
  process.exit(1)
}

// CONFIG
const getDockerTemplate = () => {
  const dockerTemplate = join(process.cwd(), 'DockerTemplate')
  if (fs.existsSync(dockerTemplate)) {
    return fs.readFileSync(dockerTemplate, 'utf8')
  }
  // TODO this default template, depends on which language we use
  const DEFAULT_DOCKER_TEMPLATE = `FROM mhart/alpine-node:$VERSION
RUN mkdir -p /usr/src/app
WORKDIR /usr/src/app
COPY package.json .
RUN npm install
COPY . .
CMD npm test
`
  return DEFAULT_DOCKER_TEMPLATE
}
const getBaseImageFromDockerfile = (dockerfile) => {
  if (dockerfile.indexOf('FROM') === -1) {
    throw new Error('Dockerfile OR DockerTemplate does not contain FROM statement')
  }
  return dockerfile.match(/FROM\ (.*):\$VERSION/)[1]
}

const DOCKERFILE_TEMPLATE = getDockerTemplate()

const DIRECTORY_TO_TEST = process.cwd()
const TEST_COMMAND = [] // Empty, is in Dockerfile

const BASE_IMAGE = getBaseImageFromDockerfile(DOCKERFILE_TEMPLATE)
const PROJECT_NAME = (function getProjectName () {
  try {
    // TODO depends on language
    return require(DIRECTORY_TO_TEST + '/package.json').name
  } catch (err) {
    return path.basename(DIRECTORY_TO_TEST)
  }
})()

var IMAGE_NAME = null
if (fs.existsSync(join(DIRECTORY_TO_TEST, '.git'))) {
  const git_commit = git.long(DIRECTORY_TO_TEST)
  IMAGE_NAME = `${PROJECT_NAME}_$VERSION:${git_commit}`
} else {
  const path_hex = (new Buffer(DIRECTORY_TO_TEST)).toString('hex')
  IMAGE_NAME = `${PROJECT_NAME}_$VERSION:${path_hex}`
}

var DOCKER_CONFIG = {}
if (use_docker_socket) {
  DOCKER_CONFIG = {socketPath: docker_socket}
} else {
  const protocol = 'https'
  const parsed_url = url.parse(process.env.DOCKER_HOST)
  const host = parsed_url.hostname
  const port = parsed_url.port
  const cert_path = process.env.DOCKER_CERT_PATH
  DOCKER_CONFIG = {
    protocol: protocol,
    host: host,
    port: port,
    ca: fs.readFileSync(join(cert_path, 'ca.pem')),
    cert: fs.readFileSync(join(cert_path, 'cert.pem')),
    key: fs.readFileSync(join(cert_path, 'key.pem'))
  }
}
// TODO implement log levels...
// const LOG_LEVEL = 'default'
// END CONFIG

// Initialize docker
const docker = new Docker(DOCKER_CONFIG)

// const createErrorHandler = (version, show_output, callback) => {
//   return (step, err) => {
//     if (err) {
//       if (show_output) {
//         logRed('Something went wrong in ' + step)
//       } else {
//         logRed(version + '\t | Something went wrong in ' + step)
//       }
//       callback(err, 1)
//     }
//   }
// }

// TODO depends on language
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

const onlyFailures = (result) => {
  return !result.success
}

const testVersions = (versions) => {
  console.log('autochecker', 'Running tests in ' + versions.length + ' different sessions | Path: ' + DIRECTORY_TO_TEST)
  async.parallelLimit(versions, process.env.TEST_LIMIT || os.cpus().length, (err, results) => {
    if (err) {
      logRed('Something went wrong when running the tests...')
      logRed(err)
      console.log('Full error:')
      console.log(err)
      throw new Error(err)
    }
    var any_errors = false
    var successes = results.filter((result) => result.success).length
    var failures = results.filter(onlyFailures).length
    console.log()
    if (failures > 0) {
      console.log(colors.red('# Failing tests'))
      results.filter(onlyFailures).forEach((failure) => {
        console.log(colors.blue('## Output from ' + failure.version))
        console.log(failure.output)
      })
    }
    console.log('== Results (Success/Fail ' + successes + '/' + failures + ') ==')
    results.forEach((result) => {
      if (result.success) {
        logGreen('The tests did pass on version ' + result.version)
      } else {
        // TODO Also print out the errors themselves
        logRed('The tests did not pass on version ' + result.version)
        any_errors = true
      }
    })
    if (any_errors) {
      process.exit(1)
    } else {
      process.exit(0)
    }
  })
}

const argv = require('minimist')(process.argv.slice(2))

if (argv._[0] === 'ls') {
  console.log('Available versions:')
  console.log(default_versions_to_test)
  process.exit(0)
}

// Setup logging
var linesToLog = {}
const createLogger = (line_id, verbose) => {
  return (msg, color) => {
    if (color === undefined) {
      color = (str) => colors.yellow(str)
    }
    if (verbose) {
      console.log(color(line_id + ' - ' + msg))
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

const runTest = (version, verbose) => {
  const logger = createLogger(version, verbose)
  return core.runTestForVersion({
    logger,
    docker,
    version,
    name: PROJECT_NAME,
    test_cmd: TEST_COMMAND,
    image_name: IMAGE_NAME,
    path: DIRECTORY_TO_TEST,
    dockerfile: DOCKERFILE_TEMPLATE,
    base_image: BASE_IMAGE,
    verbose
  })
}

const verbose = argv.verbose === true

// Start testing everything
// TODO extract this into cli.js and make proper
if (argv._.length === 0) {
  clearScreen()
  testVersions(default_versions_to_test.map((version) => runTest(version, verbose)))
} else {
  const to_test = argv._
  if (to_test.length > 1) {
    clearScreen()
    testVersions(to_test.map((version) => runTest(version, verbose)))
  } else {
    console.log(colors.green('## Running tests in version ' + colors.blue(to_test[0]) + ' only'))
    runTest(to_test[0], true)((err, result) => {
      if (err) {
        console.log(colors.red(err))
        process.exit(1)
      }
      console.log()
      console.log('== Results ==')
      if (result.success) {
        logGreen('The tests did pass on version ' + result.version)
        process.exit(0)
      } else {
        logRed('The tests did not pass on version ' + result.version)
        process.exit(1)
      }
    })
  }
}
