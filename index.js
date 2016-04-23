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
        reject(err.toString())
      } else {
        resolve(err)
      }
    })
  })
}
const writeApplicationDockerfile = (path, version, dockerfile) => {
  return new Promise((resolve, reject) => {
    if (dockerfile.indexOf('$VERSION') === -1) {
      reject('Dockerfile did not contain $VERSION')
      return
    }
    const contents = dockerfile.replace('$VERSION', version)
    fs.writeFile(path + '/Dockerfile', contents, (err) => {
      if (err) {
        if (err.code === 'ENOENT') {
          reject(`Directory "${path}" did not exist`)
        } else {
          reject(err.toString())
        }
      } else {
        resolve(err)
      }
    })
  })
}
const pullImage = (docker, base_image, version, verbose) => {
  return new Promise((resolve, reject) => {
    // TODO in the future, check if image already exists, and skip pulling
    const should_pull = true
    if (should_pull) {
      docker.pull(`${base_image}:${version}`, (err, stream) => {
        if (err) {
          reject(err)
        }
        stream.on('data', (chunk) => {
          // TODO when pulling, chunk also have progress property we should print
          // {"status":"Extracting","progressDetail":{"current":10310894,"total":10310894},
          // "progress":"[==================================================\u003e] 10.31 MB/10.31 MB",
          // "id":"c9590ff90c14"}
          if (verbose) {
            console.log(JSON.parse(chunk).status)
          }
        })
        stream.on('end', () => {
          resolve(err)
        })
      })
    } else {
      resolve(null)
    }
  })
}
const buildImage = (docker, path, image_name, verbose) => {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(path)) {
      reject('Path "' + path + '" does not exist')
    }
    const tarStream = tar.pack(path)
    docker.buildImage(tarStream, {t: image_name}, (err, stream) => {
      if (err) {
        reject(err)
      }
      if (!stream) {
        reject()
        return
      }
      stream.on('data', (chunk) => {
        if (verbose) {
          const parsed = JSON.parse(chunk.toString())
          var to_print = null
          if (parsed.status) {
            to_print = parsed.status
          }
          if (parsed.stream) {
            to_print = parsed.stream
          }
          if (parsed.error) {
            reject(parsed.error)
            return
          }
          process.stdout.write(to_print)
        }
      })
      stream.on('end', () => {
        resolve(err)
      })
    })
  })
}
const runContainer = (docker, image_name, test_cmd, verbose) => {
  return new Promise((resolve, reject) => {
    var output = []
    const collect_output_stream = new stream.Writable({
      write: (chunk, encoding, next) => {
        output.push(chunk.toString())
        next()
      }
    })
    const outputter = verbose ? process.stdout : collect_output_stream
    docker.run(image_name, test_cmd, outputter, (err, data, container) => {
      if (err) {
        reject(err)
      }
      if (!data || !container) {
        reject()
        return
      }
      var to_resolve = { success: data.StatusCode === 0 }
      if (!verbose) {
        to_resolve.output = output.join('')
      }
      container.remove( (err, data) => {
        resolve(to_resolve); 
      })
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
      logger('pulling image')
      return pullImage(docker, base_image, version, verbose)
    }).then(() => {
      logger('building image')
      return buildImage(docker, new_directory, version_image_name, verbose)
    }).then(() => {
      logger('running container')
      return runContainer(docker, version_image_name, test_cmd, verbose)
    }).then((res) => {
      const success = res.success
      const output = res.output
      logger(success ? colors.green('Test results: ✅') : colors.red('Test results: ❌'))
      callback(null, {success, version, output})
    }).catch((err) => { 
      callback(err.err) 
    })
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
