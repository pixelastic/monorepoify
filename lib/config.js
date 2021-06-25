const _ = require('golgoth/lodash');
const readJson = require('firost/readJson');
const path = require('path');
module.exports = {
  cache: {
    root: null,
    lib: null,
    docs: null,
    bin: null,
    name: null,
  },
  // Init the config with all shared variables
  async init(userRoot) {
    this.set('root', path.resolve(userRoot || '.'));
    const metadata = await readJson(this.rootPackage());

    this.set('name', metadata.name);
    this.set('lib', this.rootPath('lib'));
    this.set('docs', this.rootPath('docs'));
    this.set('bin', this.rootPath('bin'));
  },
  get(key) {
    return _.get(this.cache, key);
  },
  set(key, value) {
    _.set(this.cache, key, value);
  },
  has(key) {
    return _.has(this.cache, key);
  },

  // Helper functions
  name() {
    return this.get('name');
  },
  root() {
    return this.get('root');
  },
  rootPath(relativePath = '') {
    return path.resolve(this.get('root'), relativePath);
  },
  rootPackage() {
    return this.rootPath('package.json');
  },
  lib() {
    return this.get('lib');
  },
  libPath(relativePath = '') {
    return path.resolve(this.get('lib'), relativePath);
  },
  libPackage() {
    return this.libPath('package.json');
  },
  docs() {
    return this.get('docs');
  },
  docsPath(relativePath = '') {
    return path.resolve(this.get('docs'), relativePath);
  },
  bin() {
    return this.get('bin');
  },
};
