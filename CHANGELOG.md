### 0.9.0

* Make all example tests pass instead of failing on some versions
* Add bunch of more examples
* Add `version` and `help` command. Usage: `autochecker version`
* Start testing autochecker itself in NodeJS 6
* Refactor the streams and fix the promise handling

### 0.8.0

* Pull right base image, instead of always mhart/alpine-node
* Use minimist for parsing arguments
* Fix issue with needing to be in a Git repository for running

### 0.7.1

* More renaming of verbose

### 0.7.0

* Rename single_view -> verbose in the API
* Enable usage of docker socket if possible, fall back to API
* Move examples into examples/ folder

### 0.6.0

* Possible to use non-node languages, added a ruby example project

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
