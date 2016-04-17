/*
 * This is the file for the main logic of the application.
 * Everything basically is here, everything else is just gluing this together
 *
 */
const fs = require('fs-extra')

module.exports = {
  copyApplicationToTempLocation: (path, new_path) => {
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
  },
  writeApplicationDockerfile: (path, version, dockerfile) => {
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
  },
  pullImage: (docker, base_image, version, show_output) => {
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
}
