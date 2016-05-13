/*
 * This is the file for the main logic of the application.
 * Everything basically is here, everything else is just gluing this together
 *
 */
const fs = require('fs-extra')
const os = require('os')
const stream = require('stream')
const colors = require('colors')
const tar = require('tar-fs')

const returnOrThrow = (attribute, name) => {
  if (attribute === undefined) {
    throw new Error('Option ' + name + ' was undefined but it needs to be defined')
  }
  return attribute
}

const copyApplicationToTempLocation = (path, new_path) => {
  return new Promise((resolve, reject) => {
    fs.copy(path, new_path, {
      filter: (file) => {
        var should_include = true
        // TODO this filter depends on language used
        if (file.indexOf('node_modules') !== -1) {
          should_include = false
        }
        if (file.indexOf('.git') !== -1) {
          should_include = false
        }
        return should_include
      }
    }, (err) => {
      if (err) {
        return reject(err.toString())
      } else {
        return resolve(err)
      }
    })
  })
}
const writeApplicationDockerfile = (path, version, dockerfile) => {
  return new Promise((resolve, reject) => {
    if (dockerfile.indexOf('$VERSION') === -1) {
      return reject('Dockerfile did not contain $VERSION')
    }
    const contents = dockerfile.replace('$VERSION', version)
    fs.writeFile(path + '/Dockerfile', contents, (err) => {
      if (err) {
        if (err.code === 'ENOENT') {
          return reject(`Directory "${path}" did not exist`)
        } else {
          return reject(err.toString())
        }
      } else {
        return resolve(err)
      }
    })
  })
}
const parseStreamChunk = (chunk) => {
  const chunkStr = chunk.toString()
  const splitted = chunkStr.split('\r\n')
  const parsedLines = splitted.map((str) => {
    try {
      return JSON.parse(str)
    } catch (_) {
      return null
    }
  })
  return parsedLines.filter((l) => l !== null)
}
const pullImage = (docker, base_image, version, verbose, logger) => {
  return new Promise((resolve, reject) => {
    // TODO in the future, check if image already exists, and skip pulling
    const should_pull = true
    if (should_pull) {
      docker.pull(`${base_image}:${version}`, (err, stream) => {
        if (err) {
          return reject(err)
        }
        stream.on('data', (chunk) => {
          // TODO when pulling, chunk also have progress property we should print
          // {"status":"Extracting","progressDetail":{"current":10310894,"total":10310894},
          // "progress":"[==================================================\u003e] 10.31 MB/10.31 MB",
          // "id":"c9590ff90c14"}
          if (verbose) {
            const chunks = parseStreamChunk(chunk)
            chunks.forEach((mini_chunk) => {
              const status = mini_chunk.status
              if (status !== 'Downloading' && status !== 'Extracting') {
                console.log(mini_chunk.status)
              }
            })
          }
        })
        stream.on('end', () => {
          return resolve(err)
        })
      })
    } else {
      return resolve(null)
    }
  })
}
const buildImage = (docker, path, image_name, verbose, logger) => {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(path)) {
      return reject('Path "' + path + '" does not exist')
    }
    const tarStream = tar.pack(path)
    docker.buildImage(tarStream, {t: image_name}, (err, stream) => {
      if (err) {
        return reject(err)
      }
      if (!stream) {
        return reject()
      }
      stream.on('data', (chunk) => {
        const chunks = parseStreamChunk(chunk)
        if (chunks.length && chunks[chunks.length - 1].error) {
          return reject(chunks[chunks.length - 1].error)
        }
        if (verbose) {
          chunks.forEach((mini_chunk) => process.stdout.write(mini_chunk.stream))
        }
      })
      stream.on('end', () => {
        return resolve(err)
      })
    })
  })
}
const filterOutputStream = (chunk) => {
  return chunk.toString().split('\r\n').filter((line) => {
    return line !== null && line !== undefined && line.trim() !== ''
  })
}
const runContainer = (docker, image_name, test_cmd, verbose, logger) => {
  return new Promise((resolve, reject) => {
    var output = []
    const collect_output_stream = new stream.Writable({
      write: (chunk, encoding, next) => {
        if (verbose) {
          filterOutputStream(chunk).forEach((line) => {
            console.log(line)
          })
        }
        output.push(chunk.toString())
        next()
      }
    })
    // const outputter = verbose ? process.stdout : collect_output_stream
    docker.run(image_name, test_cmd, collect_output_stream, (err, data) => {
      if (err) {
        return reject(err)
      }
      if (!data) {
        return reject()
      }
      var to_resolve = {success: data.StatusCode === 0}
      to_resolve.output = output.join('')
      return resolve(to_resolve)
    })
  })
}
const runTestForVersion = (opts) => {
  const logger = returnOrThrow(opts.logger, 'logger')
  const docker = returnOrThrow(opts.docker, 'docker')
  const version = returnOrThrow(opts.version, 'version')
  const name = returnOrThrow(opts.name, 'name')
  const test_cmd = returnOrThrow(opts.test_cmd, 'test_cmd')
  const image_name = returnOrThrow(opts.image_name, 'image_name')
  const path = returnOrThrow(opts.path, 'path')
  const dockerfile = returnOrThrow(opts.dockerfile, 'dockerfile')
  const base_image = returnOrThrow(opts.base_image, 'base_image')
  const verbose = returnOrThrow(opts.verbose, 'verbose')

  return (callback) => {
    const tmp_dir = os.tmpdir()

    const new_directory = `${tmp_dir}/autochecker_${name}_${version}`
    const version_image_name = image_name.replace('$VERSION', version)
    logger('copying files')
    copyApplicationToTempLocation(path, new_directory).then(() => {
      logger('writing dockerfile')
      return writeApplicationDockerfile(new_directory, version, dockerfile)
    }).then(() => {
      logger(`pulling image ${base_image}:${version}`)
      return pullImage(docker, base_image, version, verbose, logger)
    }).then(() => {
      logger('building image')
      return buildImage(docker, new_directory, version_image_name, verbose, logger)
    }).then(() => {
      logger('running container')
      return runContainer(docker, version_image_name, test_cmd, verbose, logger)
    }).then((res) => {
      const success = res.success
      const output = res.output
      logger(success ? colors.green('Test results: ✅') : colors.red('Test results: ❌'))
      callback(null, {success, version, output})
    }).catch((err) => { callback(err) })
  }
}
module.exports = {
  runTestForVersion,
  copyApplicationToTempLocation,
  writeApplicationDockerfile,
  pullImage,
  buildImage,
  runContainer
}
