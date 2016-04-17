/*
 * This is the file for the main logic of the application.
 * Everything basically is here, everything else is just gluing this together
 *
 */
const fs = require('fs-extra')
const os = require('os')
const colors = require('colors')
const tar = require('tar-fs')

const copyApplicationToTempLocation = (path, new_path) => {
  return new Promise((resolve, reject) => {
    fs.copy(path, new_path, {
      filter: (file) => {
        var should_include = true
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
    fs.writeFile(path + '/Dockerfile', dockerfile.replace('$VERSION', version), (err) => {
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
const pullImage = (docker, base_image, version, show_output) => {
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
          if (show_output) {
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
const buildImage = (docker, path, image_name, show_output) => {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(path)) {
      reject('Path "' + path + '" does not exist')
    }
    const tarStream = tar.pack(path)
    docker.buildImage(tarStream, {t: image_name}, (err, stream) => {
      if (err) {
        reject(err)
      }
      stream.on('data', (chunk) => {
        if (show_output) {
          process.stdout.write(JSON.parse(chunk).stream)
        }
      })
      stream.on('end', () => {
        resolve(err)
      })
    })
  })
}
const runContainer = (docker, image_name, test_cmd, show_output) => {
  return new Promise((resolve, reject) => {
    const outputter = show_output ? process.stdout : null
    docker.run(image_name, test_cmd, outputter, (err, data) => {
      if (err) {
        reject(err)
      }
      resolve(data.StatusCode === 0)
    })
  })
}
const runTestForVersion = (logger, docker, version, project_name, test_command, app_image_name, directory_to_test, dockerfile, base_image, show_output) => {
  return (callback) => {
    const tmp_dir = os.tmpdir()

    const new_directory = `${tmp_dir}/autochecker_${project_name}_${version}`
    const version_image_name = app_image_name.replace('$VERSION', version)
    logger('copying files')
    copyApplicationToTempLocation(directory_to_test, new_directory).then(() => {
      logger('writing dockerfile')
      return writeApplicationDockerfile(new_directory, version, dockerfile)
    }).then(() => {
      logger('pulling image')
      return pullImage(docker, base_image, version, show_output)
    }).then(() => {
      logger('building image')
      return buildImage(docker, new_directory, version_image_name, show_output)
    }).then(() => {
      logger('running container')
      return runContainer(docker, version_image_name, test_command, show_output)
    }).then((success) => {
      logger(success ? colors.green('Test results: ✅') : colors.red('Test results: ❌'))
      callback(null, {success, version})
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
