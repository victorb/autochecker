# autochecker

autochecker helps you test your JavaScript modules in many different versions of NodeJS, rapidly and without thinking about it.

Works well with CI as well!

<p align="center">
  <img src="./demo.gif" alt="Demonstration of functionality">
</p>

## Requirements

* Docker
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

`autochecker 0.10 0.11 4 5.10.1 latest`

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

## Changelog

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
