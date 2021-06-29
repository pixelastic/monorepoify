const config = require('./config.js');
const copy = require('firost/copy');
const exist = require('firost/exist');
const mkdirp = require('firost/mkdirp');
const move = require('firost/move');
const readJson = require('firost/readJson');
const read = require('firost/read');
const remove = require('firost/remove');
const run = require('firost/run');
const writeJson = require('firost/writeJson');
const write = require('firost/write');
const _ = require('golgoth/lodash');

module.exports = {
  async run(userRoot) {
    await config.init(userRoot);

    await this.rescopePackageToLib();
    await this.createMonorepoRoot();
    await this.createDocsWorkspace();
  },

  /**
   * Move the root package.json to ./lib and fix its content
   * This will replace all relative links to ./lib to ./ and set the default
   * name/bugs/homepage needed
   **/
  async rescopePackageToLib() {
    const name = config.name();

    // yarn unlink in root
    await this.yarnUnlink(config.root());

    // Create ./lib if missing
    await mkdirp(config.lib());

    // Move the root package.json there
    await move(config.rootPackage(), config.libPackage());

    // If there was a ./bin folder in the root, move it as well
    if (await exist(config.bin())) {
      await move(config.bin(), config.libPath('bin'));
    }

    // Update all relative paths to stop targeting lib
    const data = await readJson(config.libPackage());
    data.main = _.chain(data).get('main').replace('lib/', '').value();
    data.files = _.map(data.files, (file) => {
      return file.replace('lib/', '');
    });

    // Update links to target the ones in the root
    data.scripts = _.transform(data.scripts, (result, value, key) => {
      result[key] = value.replace('./scripts/', '../scripts/lib/');
    });

    // Remove aberlaas from devDependencies
    let devDependencies = _.omit(data.devDependencies, ['aberlaas']);
    if (_.isEmpty(devDependencies)) {
      devDependencies = undefined;
    }
    data.devDependencies = devDependencies;

    // Add a shorthand repository field
    data.repository = `pixelastic/${name}`;

    // Add a homepage
    data.homepage = `https://projects.pixelastic.com/${name}/`;

    // Add myself as the author
    data.author = 'Tim Carry (@pixelastic)';

    // Set a default license if missing
    data.license = data.license || 'MIT';

    // Put keys in a specific order in the json and remove empty keys
    const sortedData = _.omitBy(
      {
        // Metadata
        name: data.name,
        description: data.description,
        version: data.version,
        repository: data.repository,
        homepage: data.homepage,
        author: data.author,
        license: data.license,
        // Package content
        main: data.main,
        files: data.files,
        bin: data.bin,
        dependencies: data.dependencies,
        // Dev
        engines: data.engines,
        devDependencies: data.devDependencies,
        scripts: data.scripts,
        // Original keys
        ...data,
        // Removed keys
        bugs: undefined,
      },
      _.isUndefined
    );

    await writeJson(sortedData, config.libPackage(), { sort: false });

    // Run yarn unlink in the root, and run it back in ./lib
    await this.yarnLink(config.lib());
  },
  /**
   * Create the Yarn workspaces, with a root monorepo and a ./docs and ./lib
   * workspace
   **/
  async createMonorepoRoot() {
    // Create the root package.json
    const name = config.name();
    const newPackage = await config.getTemplate('package.json');
    newPackage.name = newPackage.name.replace('{name}', name);
    newPackage.description = newPackage.description.replace('{name}', name);
    newPackage.homepage = newPackage.homepage.replace('{name}', name);
    await writeJson(newPackage, config.rootPath('package.json'), {
      sort: false,
    });

    // Add aberlaas and lerna as top level dependencies
    await this.addRootDevDependencies(['lerna', 'aberlaas']);

    // Configure lerna
    const lernaConfig = await config.getTemplate('lerna.json');
    lernaConfig.version = config.version();
    const lernaConfigPath = config.rootPath('lerna.json');
    await writeJson(lernaConfig, lernaConfigPath, { sort: false });

    // Replace the ./scripts with new ones
    await remove(config.rootPath('scripts'));
    await copy(config.templatePath('scripts'), config.rootPath('scripts'));
  },
  async createDocsWorkspace() {
    const name = config.name();
    const description = config.description();

    // Create the ./docs folder
    await mkdirp(config.docs());

    // Create the docs package.json
    const docsPackage = await config.getTemplate('docs/package.json');
    docsPackage.name = docsPackage.name.replace('{name}', name);
    docsPackage.version = config.version();
    await writeJson(docsPackage, config.docsPath('package.json'), {
      sort: false,
    });

    // Add norska and norska-theme-docs
    await this.addDocsDependencies(['norska', 'norska-theme-docs']);

    // Init norska
    await this.norskaInit();

    // Remove the newly created ./scripts
    await remove(config.docsPath('./scripts'));

    // Use the norska-theme-docs
    await copy(
      config.templatePath('docs/norska.config.js'),
      config.docsPath('norska.config.js')
    );

    // Update _data/meta.json
    const meta = {
      title: name,
      description,
      productionUrl: `https://projects.pixelastic.com/${name}/`,
      twitter: 'pixelastic',
    };
    const metaPath = config.docsPath('src/_data/meta.json');
    await writeJson(meta, metaPath, { sort: false });

    // Add default _data/theme.js
    await copy(
      config.templatePath('docs/src/_data/theme.js'),
      config.docsPath('src/_data/theme.js')
    );

    // Move ./docs/netlify.toml to the root and update the publish dir
    const docsNetlifyTomlPath = config.docsPath('netlify.toml');
    const docsNetlifyToml = await read(docsNetlifyTomlPath);
    const rootNetlifyToml = _.chain(docsNetlifyToml)
      .split('\n')
      .map((line) => {
        const regexp = /^\s*publish =/;
        const matches = line.match(regexp);
        if (!matches) {
          return line;
        }
        return '  publish = "docs/dist/"';
      })
      .join('\n')
      .value();
    await write(rootNetlifyToml, config.rootPath('netlify.toml'));
    await remove(docsNetlifyTomlPath);

    // Update ./docs/src/index.md with the README content
    const rootReadmeContent = (
      await read(config.rootPath('README.md'))
    ).replace(`# ${name}`, '');
    const docsIndexTemplate = await config.getTemplate('docs/src/index.md');
    const docsIndexContent = _.chain(docsIndexTemplate)
      .replace('{name}', name)
      .replace('{description}', description)
      .replace('{readme}', rootReadmeContent)
      .replace('\n\n\n', '\n')
      .value();
    await write(docsIndexContent, config.docsPath('src/index.md'));

    // Remove all other readmes
    await remove(config.rootPath('README.md'));
    await remove(config.libPath('README.md'));
    await remove(config.docsPath('src/index.pug'));

    // Regenerate the secondary readme
    await this.aberlaasReadme();
  },

  /**
   * MOCKABLE METHODS
   * The following code is wrapped in methods so we can mock it in test to
   * prevent running real commands
   **/
  /**
   * Add dev dependencies at the root
   * @param {Array} dependencies List of dependencies to add
   */
  async addRootDevDependencies(dependencies = []) {
    const command = `yarn add --dev -W ${dependencies.join(' ')}`;
    await run(command);
  },
  /**
   * Add dependencies in ./docs
   * @param {Array} dependencies List of dependencies to add
   */
  async addDocsDependencies(dependencies = []) {
    const command = `cd ${config.docs()} && yarn add ${dependencies.join(' ')}`;
    await run(command, { shell: true });
  },
  /**
   * Run yarn unlink in specified directory
   * @param {string} directory Directory to unlink
   **/
  async yarnUnlink(directory) {
    await run(`cd ${directory} && yarn unlink`, { shell: true });
  },
  /**
   * Run yarn link in specified directory
   * @param {string} directory Directory to unlink
   **/
  async yarnLink(directory) {
    await run(`cd ${directory} && yarn link`, { shell: true });
  },
  /**
   * Run norska init in ./docs
   **/
  async norskaInit() {
    await run(`cd ${config.docs()} && yarn run norska init`, {
      shell: true,
      stdin: true,
    });
  },
  /**
   * Run aberlaas readme in root
   **/
  async aberlaasReadme() {
    await run('yarn run aberlaas readme', {
      shell: true,
    });
  },
};
