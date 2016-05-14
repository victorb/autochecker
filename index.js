/*
 * This is the file for the main logic of the application.
 * Everything basically is here, everything else is just gluing this together
 *
 */
const fs = require('fs-extra')
const stream = require('stream')
const colors = require('colors')
const tar = require('tar-fs')

const returnOrThrow = (attribute, name) => {
  if (attribute === undefined) {
    throw new Error('Option ' + name + ' was undefined but it needs to be defined')
  }
  return attribute
}

const assertObjectContainKeys = (obj, keys) => {
  if (!obj) {
    throw new Error('Object was null/undefined/false')
  }
  const obj_keys = Object.keys(obj)
  keys.forEach((cur_key) => {
    if (obj_keys.indexOf(cur_key) === -1) {
      throw new Error('Object did not contain key "' + cur_key + '"')
    }
    if (obj[cur_key] === undefined) {
      throw new Error('Object had key "' + cur_key + '" but it was undefined')
    }
  })
}

const setVersionInDockerfile = (version, dockerfile) => {
  if (dockerfile.indexOf('$VERSION') === -1) {
    throw new Error('Dockerfile did not contain $VERSION')
  }
  return dockerfile.replace('$VERSION', version)
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
const pullImage = (opts) => {
  assertObjectContainKeys(opts, [
    'docker',
    'base_image',
    'version',
    'verbose'
  ])
  return new Promise((resolve, reject) => {
    // TODO in the future, check if image already exists, and skip pulling
    const should_pull = true
    if (should_pull) {
      opts.docker.pull(`${opts.base_image}:${opts.version}`, (err, stream) => {
        if (err) {
          return reject(err)
        }
        stream.on('data', (chunk) => {
          // TODO when pulling, chunk also have progress property we should print
          // {"status":"Extracting","progressDetail":{"current":10310894,"total":10310894},
          // "progress":"[==================================================\u003e] 10.31 MB/10.31 MB",
          // "id":"c9590ff90c14"}
          if (opts.verbose) {
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
const buildImage = (opts) => {
  assertObjectContainKeys(opts, [
    'docker',
    'path',
    'image_name',
    'dockerfile',
    'verbose'
  ])
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(opts.path)) {
      return reject('Path "' + opts.path + '" does not exist')
    }
    const tarStream = tar.pack(opts.path)
    tarStream.entry({ name: 'Dockerfile' }, opts.dockerfile)
    opts.docker.buildImage(tarStream, {t: opts.image_name}, (err, stream) => {
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
        if (opts.verbose) {
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
const runContainer = (opts) => {
  assertObjectContainKeys(opts, [
    'docker',
    'image_name',
    'test_cmd',
    'verbose'
  ])
  return new Promise((resolve, reject) => {
    var output = []
    const collect_output_stream = new stream.Writable({
      write: (chunk, encoding, next) => {
        if (opts.verbose) {
          filterOutputStream(chunk).forEach((line) => {
            console.log(line)
          })
        }
        output.push(chunk.toString())
        next()
      }
    })
    // const outputter = verbose ? process.stdout : collect_output_stream
    opts.docker.run(opts.image_name, opts.test_cmd, collect_output_stream, (err, data) => {
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
  const test_cmd = returnOrThrow(opts.test_cmd, 'test_cmd')
  const image_name = returnOrThrow(opts.image_name, 'image_name')
  const path = returnOrThrow(opts.path, 'path')
  const dockerfile_raw = returnOrThrow(opts.dockerfile, 'dockerfile')
  const base_image = returnOrThrow(opts.base_image, 'base_image')
  const verbose = returnOrThrow(opts.verbose, 'verbose')

  const versioned_image_name = image_name.replace('$VERSION', version)
  const dockerfile = setVersionInDockerfile(version, dockerfile_raw)

  const cmd_opts = {
    docker,
    base_image,
    image_name: versioned_image_name,
    version,
    verbose,
    logger,
    path,
    test_cmd,
    dockerfile
  }

  return (callback) => {
    logger(`pulling image ${base_image}:${version}`)
    pullImage(cmd_opts).then(() => {
      logger('building image')
      return buildImage(cmd_opts)
    }).then(() => {
      logger('running container')
      return runContainer(cmd_opts)
    }).then((res) => {
      const success = res.success
      const output = res.output
      logger(success ? colors.green('Test results: ✅') : colors.red('Test results: ❌'))
      callback(null, {success, version, output})
    }).catch((err) => {
      callback(err)
    })
  }
}
module.exports = {
  runTestForVersion,
  pullImage,
  buildImage,
  runContainer
}
