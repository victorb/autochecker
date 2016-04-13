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

## Custom Docker file template

You can specify custom Docker file template if you need additional tools installed, for
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
