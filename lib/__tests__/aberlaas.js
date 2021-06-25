const current = require('../main');
const config = require('../config');
const mkdirp = require('firost/mkdirp');
const copy = require('firost/copy');
const emptyDir = require('firost/emptyDir');
const glob = require('firost/glob');
const read = require('firost/read');
const readJson = require('firost/readJson');
const writeJson = require('firost/writeJson');
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
    // Do not really run yarn add, but simply add stuff to package.json
  });
  beforeEach(async () => {
    jest
      .spyOn(current, 'addRootDevDependencies')
      .mockImplementation(async (dependencies) => {
        const packagePath = config.rootPath('package.json');
        const rootPackage = await readJson(packagePath);
        _.each(dependencies, (dependency) => {
          rootPackage.devDependencies[dependency] = '1.42';
        });
        await writeJson(rootPackage, packagePath, { sort: false });
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
