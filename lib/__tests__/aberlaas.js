const current = require('../main');
const config = require('../config');
const copy = require('firost/copy');
const emptyDir = require('firost/emptyDir');
const glob = require('firost/glob');
const mkdirp = require('firost/mkdirp');
const readJson = require('firost/readJson');
const read = require('firost/read');
const writeJson = require('firost/writeJson');
const write = require('firost/write');
const newFile = require('firost/newFile');
const path = require('path');
const _ = require('golgoth/lodash');
const pMap = require('golgoth/pMap');

describe('aberlaas base', () => {
  const tmpDirectory = './tmp/aberlaas';
  const inputDir = './fixtures/input';
  const expectedDir = './fixtures/expected';
  beforeAll(async () => {
    await mkdirp(tmpDirectory);
    await emptyDir(tmpDirectory);
    await copy(`${inputDir}/*`, tmpDirectory);
  });
  beforeEach(async () => {
    // Do not really run yarn add, but simply add stuff to package.json
    jest
      .spyOn(current, 'addRootDevDependencies')
      .mockImplementation(async (dependencies) => {
        const packagePath = config.rootPath('package.json');
        const rootPackage = await readJson(packagePath);
        _.each(dependencies, (dependency) => {
          _.set(rootPackage, `devDependencies.${dependency}`, '1.42');
        });
        await writeJson(rootPackage, packagePath, { sort: false });
      });
    jest
      .spyOn(current, 'addDocsDependencies')
      .mockImplementation(async (dependencies) => {
        const packagePath = config.docsPath('package.json');
        const docsPackage = await readJson(packagePath);
        _.each(dependencies, (dependency) => {
          _.set(docsPackage, `dependencies.${dependency}`, '1.42');
        });
        await writeJson(docsPackage, packagePath, { sort: false });
      });

    // Do not really run yarn link/unlink, touch a file instead
    jest.spyOn(current, 'yarnLink').mockImplementation(async (directory) => {
      await write('link', path.resolve(directory, 'yarn.link'));
    });
    jest.spyOn(current, 'yarnUnlink').mockImplementation(async (directory) => {
      await write('unlink', path.resolve(directory, 'yarn.unlink'));
    });

    jest.spyOn(current, 'norskaInit').mockImplementation(async () => {
      await write('norska init', config.docsPath('norska.init'));
      // Create the ./scripts directory
      await write('dummy script', config.docsPath('scripts/build'));
      // Create a netlify.toml file
      const netlifyToml = await config.getTemplate('docs/netlify.toml');
      await write(netlifyToml, config.docsPath('netlify.toml'));
      // Create a ./src/index.pug file
      await newFile(config.docsPath('src/index.pug'));
    });

    jest.spyOn(current, 'aberlaasReadme').mockImplementation(async () => {
      await write('aberlaas readme', config.rootPath('aberlaas.readme'));
    });
  });

  /**
   * Return the list of files in a given directory, removing the directory
   * prefix
   * @param {string} cwd Base directory
   * @returns {Array} List of paths
   */
  async function listFiles(cwd) {
    const files = await glob(`${cwd}/**/*`, { directories: false });
    return _.map(files, (filepath) => {
      return path.relative(cwd, filepath);
    });
  }

  it('default aberlaas repo', async () => {
    await current.run(tmpDirectory);

    // Same files in input and expected
    const actualFiles = await listFiles(tmpDirectory);
    const expectedFiles = await listFiles(expectedDir);
    expect(actualFiles).toEqual(expectedFiles);

    // Same file content
    await pMap(actualFiles, async (filepath) => {
      // Compare file content
      const actualContent = await read(path.resolve(tmpDirectory, filepath));
      const expectedContent = await read(path.resolve(expectedDir, filepath));
      expect(actualContent).toEqual(expectedContent);
    });
  });
});
