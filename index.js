#! /usr/bin/env node
const os = require('os')
const readline = require('readline')
const url = require('url')
const join = require('path').join

const Docker = require('dockerode')
const fs = require('fs-extra')
const async = require('async')
const colors = require('colors/safe')
const git = require('git-rev-sync')
const tar = require('tar-fs')

const logGreen = (msg) => console.log(colors.green(msg))
const logRed = (msg) => console.log(colors.red(msg))
const clearScreen = () => {
  readline.cursorTo(process.stdout, 0, 0)
  readline.clearScreenDown(process.stdout)
}

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
// END CONFIG

// Initialize docker
const docker = new Docker(DOCKER_CONFIG)

// Setup logging
var linesToLog = {}
const createLogger = (line_id, single_view) => {
  return (msg) => {
    if (single_view) {
      console.log(line_id + '\t| ' + msg)
    } else {
      linesToLog[line_id] = msg
      Object.keys(linesToLog).forEach((line, index) => {
        const lineToLog = linesToLog[line]
        readline.cursorTo(process.stdout, 0, index + 1)
        process.stdout.write(line + '\t- ' + lineToLog + '\n')
      })
    }
  }
}

// TODO fix callback hell
const runTestForVersion = (version, show_output) => {
  const logger = createLogger(version, show_output)
  return (callback) => {
    const new_directory = TMP_DIR + '/autochecker_' + PROJECT_NAME + version

    fs.copy(DIRECTORY_TO_TEST, new_directory, {filter: (file) => {
      var should_copy = true
      // TODO find a way to reuse node_module but rebuild if necessary
      if (file.indexOf('node_modules') !== -1) {
        should_copy = false
      }
      if (file.indexOf('.git') !== -1) {
        should_copy = false
      }
      return should_copy
    }}, (err) => {
      if (err) {
        logRed(version + '\t| Something went wrong in copying files...')
        callback(err, 1)
      }
      // TODO remove sync operations like these
      fs.writeFileSync(new_directory + '/Dockerfile', DOCKERFILE_TEMPLATE.replace('$VERSION', version))

      logger('Pulling base image')
      docker.pull(`${BASE_IMAGE}:${version}`, (err, stream) => {
        // TODO extract error handling
        if (err) {
          logRed(version + '\t| Something went wrong in pulling image...')
          callback(err, 1)
        }
        docker.modem.followProgress(stream, () => {
          const tarStream = tar.pack(new_directory, {
            ignoreFiles: ['.gitignore', '.dockerignore']
          })
          const img_name_with_version = IMAGE_NAME.replace('$VERSION', version)
          logger('Building testing image')
          docker.buildImage(tarStream, {
            t: img_name_with_version
          }, (error, output) => {
            if (error) {
              logRed(version + '\t| Something went wrong in building image...')
              callback(error, 1)
            }
            docker.modem.followProgress(output, () => {
              logger('Running application tests')
              docker.run(img_name_with_version, TEST_COMMAND, show_output ? process.stdout : null, (err, data, container) => {
                if (err) {
                  logRed(version + '\t| Something went wrong in running container...')
                  callback(err, 1)
                }
                // TODO implement proper cleanup
                // fs.remove(new_directory)
                logger(colors.green('Done running all the tests!'))
                callback(null, {statusCode: data.StatusCode, version: version})
              })
            }, (chunk) => {
              // Building container
              if (show_output) {
                process.stdout.write(version + '\t| ' + chunk.stream)
              }
            })
          })
        }, (chunk) => {
          // Pulling image
          if (show_output) {
            console.log(version + '\t| ' + chunk.status)
          }
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
  async.parallel(versions, (err, results) => {
    if (err) {
      logRed('Something went wrong in running tests...')
      throw new Error(err)
    }
    var any_errors = false
    var successes = results.filter((result) => result.statusCode === 0).length
    var failures = results.filter((result) => result.statusCode !== 0).length
    clearScreen()
    console.log()
    console.log('== Results (Success/Fail ' + successes + '/' + failures + ') ==')
    results.forEach((result) => {
      if (result.statusCode !== 0) {
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

// Start testing everything
// TODO extract this into cli.js and make proper
clearScreen()
if (process.argv[2] === undefined) {
  testVersions(default_versions_to_test.map((version) => runTestForVersion(version, false)))
} else {
  const to_test = process.argv.slice(2)
  if (to_test.length > 1) {
    testVersions(to_test.map((version) => runTestForVersion(version, false)))
  } else {
    console.log('Running tests in 1 NodeJS version')
    runTestForVersion(to_test[0], true)((err, result) => {
      if (err) {
        logRed('Something went wrong in running tests...')
        throw new Error(err)
      }
      clearScreen()
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
