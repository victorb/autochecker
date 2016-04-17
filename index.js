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
const pullImage = (docker, base_image, version, single_view_output) => {
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
          if (single_view_output) {
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
const buildImage = (docker, path, image_name, single_view_output) => {
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
        if (single_view_output) {
          process.stdout.write(JSON.parse(chunk).stream)
        }
      })
      stream.on('end', () => {
        resolve(err)
      })
    })
  })
}
const runContainer = (docker, image_name, test_cmd, single_view_output) => {
  return new Promise((resolve, reject) => {
    const outputter = single_view_output ? process.stdout : null
    docker.run(image_name, test_cmd, outputter, (err, data) => {
      if (err) {
        reject(err)
      }
      resolve(data.StatusCode === 0)
    })
  })
}
// Arguments:
// logger: function that takes string as argument and does something, outputs it or something
// docker: dockerode instance of the docker client
// project_name: string of project that is built, example: 'autochecker'
// test_command: array of command for running in container, example: ['npm', 'test']
// app_image_name: built image name, example: `${PROJECT_NAME}_$VERSION:${GIT_COMMIT}`
// directory_to_test: string of path of project to build, example: '/home/victor/projects/autochecker'
// dockerfile: string of the Dockerfile to write and use for building image
// base_image: string of the image to base the application image on, example: 'mhart/alpine-node'
// single_view_output: to show full output or not
const runTestForVersion = (logger, docker, version, project_name, test_command, app_image_name, directory_to_test, dockerfile, base_image, single_view_output) => {
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
      return pullImage(docker, base_image, version, single_view_output)
    }).then(() => {
      logger('building image')
      return buildImage(docker, new_directory, version_image_name, single_view_output)
    }).then(() => {
      logger('running container')
      return runContainer(docker, version_image_name, test_command, single_view_output)
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
