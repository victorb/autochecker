# autochecker

autochecker helps you test your JavaScript modules in many different versions of NodeJS, rapidly and without thinking about it.

Works well with CI as well!

<p align="center">
  <img src="./demo.gif" alt="Demonstration of functionality">
</p>

## Requirements

* Docker -> [install here](https://www.docker.com/products/docker-toolbox)
* `package.json` `scripts.test` setup correctly
* Two environment variables, `DOCKER_HOST` and `DOCKER_CERT_PATH` (comes by default with docker-machine)

`DOCKER_HOST` should look similar to this: `tcp://192.168.99.100:2376`

`DOCKER_CERT_PATH` should look similar to this: `/Users/victor/.docker/machine/machines/default`

## Installation

As always, one step:

* For one project > `npm install autochecker`

* Globally on your computer > `npm install -g autochecker`

For extra style points, make sure autochecker is run before publishing your modules:

In `package.json`:

```json
"scripts": {
	"prepublish": "autochecker 0.10 0.12 4.0 5.0"
}
```

## Running

By default, executing `autochecker` will run the tests on all available versions.

You can specify which versions you want to test by adding them in the end of the command:

`autochecker 0.10 0.11 4 5.10.1`

Versions comes from the `mhart/alpine-node` docker image tags

## Setting max running tests

By default, autochecker starts as many testing sessions as `os.cpu().length` would return. 

However, you can overwrite this by providing the TEST_LIMIT environment variable.

Example: `TEST_LIMIT=10 autochecker` to run 10 test sessions at a time

## Custom Dockerfile template

You can specify custom Dockerfile template if you need additional tools installed, for
example if you need `git`, create a file in the project `DockerTemplate` with the following

```
FROM mhart/alpine-node:$VERSION
RUN mkdir -p /usr/src/app
WORKDIR /usr/src/app
COPY package.json .
# Adding extra tools
RUN apk add --update git
RUN npm install
COPY . .
```

Variable `$VERSION` will be replaced by autochecker. More information about alpine images
and additional tools at 
[docker-alpine](https://github.com/gliderlabs/docker-alpine/blob/master/docs/usage.md) and
[alpine-node](https://github.com/mhart/alpine-node).

Aside from adding libraries to the container, the custom template can be useful to avoid running postinstall
hooks. Just use `RUN npm install --ignore-scripts` instead.

## Programmatic API

You can use `autochecker` in your own projects from NodeJS directly.

```javascript
var autochecker = require('autochecker')
const Docker = require('dockerode')
var dockerode_instance = new Docker({socketPath: '/var/run/docker.sock'});
autochecker.runTestForVersion({
  logger: (msg) => { console.log(msg) },
  docker: dockerode_instance,
  version: '1.1.1', // version of project
  name: 'myproject', // name of project
  test_cmd: ['npm', 'test'], // command to run tests with
  image_name: 'app/image:commit', // What the built application image will be called
  path: join(__dirname, 'path_to_project'), // Path to project to build
  dockerfile: 'FROM nodejs:$VERSION', // Dockerfile
  base_image: 'base/image', // Base image, will add :$VERSION to the end
  single_view: false // To show full output or not
})((err, results) => {
  console.log(results)
  // => {version: '1.1.1', success: true || false, output: 'output from test_cmd'}
})
```

See `cli.js` for usage with testing multiple versions at once.

## Changelog

### 0.5.2

* Show errors coming from docker

### 0.5.1

* Show the test statistics (# of failing/succeeded tests) after showing the errors

### 0.5.0

* Show the failing versions output

### 0.4.0

* New `opts` (Object with parameter) arguments for module usage, instead of 1000 arguments

### 0.3.1

* CLI and library are now separated, enabling you to include autochecker directly in your project
if wanted. See usage in the "Programmatic API" section above.

### 0.3.0

* Add `autochecker ls` command for checking all available versions to test on
* More splitting up code

### 0.2.2

* Starting to split up things and start testing
* Started using autochecker for checking autochecker in version 4 and 5
* Limit to amount of tests running in parallel, controlled by `TEST_LIMIT` env var

### 0.2.0

* Support for custom Dockerfile template (thanks to @bahmutov)
* Fancier logging

### 0.1.0

* Initial release

## License

MIT License 2016 - Victor Bjelkholm
