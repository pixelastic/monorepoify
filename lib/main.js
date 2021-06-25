const config = require('./config.js');
const readJson = require('firost/readJson');
const writeJson = require('firost/writeJson');
const remove = require('firost/remove');
const copy = require('firost/copy');
const exist = require('firost/exist');
const run = require('firost/run');
const mkdirp = require('firost/mkdirp');
const move = require('firost/move');
const _ = require('golgoth/lodash');

module.exports = {
  async run(userRoot) {
    await config.init(userRoot);

    await this.rescopePackageToLib();
    await this.createMonorepoRoot();

    // Misc
    // Unlink yarn in root, link it in ./lib
  },

  /**
   * Move the root package.json to ./lib and fix its content
   * This will replace all relative links to ./lib to ./ and set the default
   * name/bugs/homepage needed
   **/
  async rescopePackageToLib() {
    const name = config.name();

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

    // TODO: Run yarn unlink in root and yarn link in lib
    // (wrap this in a method so we can mock it in tests)
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
  /**
   * Add dev dependencies at the root
   * We wrap this in a method so we can mock it in tests
   * @param {Array} dependencies List of dependencies to add
   */
  async addRootDevDependencies(dependencies = []) {
    const command = `yarn add --dev -W ${dependencies.join(' ')}`;
    await run(command);
  },

  // create the top level package.json with the yarn workspaces

  // await this.prepareRoot();
  // await this.prepareLib();
  // await this.prepareDocs();

  // await this.install();

  // await this.postInstallDocs();
  // // Prepare the root
  // async prepareRoot() {
  //   // Remove any yarn link at the root
  //   await run('yarn unlink');

  //   const baseData = await this.initialPackage();
  //   const { name, version } = baseData;

  //   // Write package.json
  //   const template = await this.getTemplate('package.json');
  //   template.name = template.name.replace('{name}', name);
  //   template.description = template.description.replace('{name}', name);
  //   template.homepage = template.homepage.replace('{name}', name);
  //   await writeJson(template, this.rootPath('package.json'));

  //   // Replace scripts
  //   await remove(this.rootPath('scripts'));
  //   await copy(this.templatePath('scripts'), this.rootPath('scripts'));

  //   // Configure lerna
  //   const lernaConfig = await this.getTemplate('lerna.json');
  //   lernaConfig.version = version;
  //   const lernaFinal = await this.rootPath('lerna.json');
  //   await writeJson(lernaConfig, lernaFinal);
  // },

  // // Prepare the docs folder
  // // Create the directory, puts a package.json with links to documentation
  // // website and set default dependencies
  // async prepareDocs() {
  //   const baseData = await this.initialPackage();
  //   const { name, version } = baseData;

  //   // Write package.json
  //   const template = await this.getTemplate('docs/package.json');
  //   template.homepage = template.homepage.replace('{name}', name);
  //   template.name = template.name.replace('{name}', name);
  //   template.version = template.version.replace('{version}', version);
  //   await writeJson(template, this.rootPath('docs/package.json'));
  // },
  // // Prepare the lib folder
  // // Create the directory, create a package that references the same file as
  // // before but in a ./lib folder, same for all the scripts
  // async prepareLib() {
  //   const baseData = await this.initialPackage();
  //   const { name } = baseData;
  //   const files = _.chain(baseData)
  //     .get('files')
  //     .map((file) => {
  //       return file.replace('lib/', '');
  //     })
  //     .value();
  //   const scripts = _.chain(baseData)
  //     .get('scripts')
  //     .transform((result, value, key) => {
  //       result[key] = value.replace('./scripts/', '../scripts/lib/');
  //     })
  //     .value();
  //   const libPackage = {
  //     ...baseData,
  //     devDependencies: undefined,
  //     main: 'main.js',
  //     files,
  //     scripts,
  //     repository: `pixelastic/${name}`,
  //     homepage: `https://projects.pixelastic.com/${name}/`,
  //   };
  //   await writeJson(libPackage, this.rootPath('lib/package.json'));

  //   // Move bin directory if available
  //   if (await isDirectory(this.rootPath('bin/'))) {
  //     await move(this.rootPath('bin/'), this.rootPath('lib/bin'));
  //   }

  //   // Add a yarn link here
  //   const libPath = this.rootPath('lib');
  //   await run(`cd ${libPath} && yarn link`, { shell: true });
  // },
  // // Install all dependencies
  // async install() {
  //   // Dev dependencies
  //   await run('yarn install && yarn upgrade aberlaas@latest lerna@latest', {
  //     shell: true,
  //   });

  //   // Docs
  //   const docsPath = this.rootPath('docs');
  //   await run(
  //     `cd ${docsPath} && yarn upgrade norska@latest norska-theme-docs@latest && yarn install`,
  //     { shell: true }
  //   );
  //   await run(`cd ${docsPath} && yarn run norska init`, {
  //     shell: true,
  //     stdin: true,
  //   });
  //   await remove(path.resolve(docsPath, 'scripts'));
  // },

  // // Fixes after install
  // async postInstallDocs() {
  //   // Update netlify.toml
  //   const docsToml = this.rootPath('./docs/netlify.toml');
  //   const rootToml = this.rootPath('./netlify.toml');
  //   let netlifyConf = await read(docsToml);
  //   netlifyConf = netlifyConf.replace('"./dist/"', '"docs/dist"');
  //   netlifyConf = netlifyConf.replace('"dist/"', '"docs/dist"');
  //   await write(netlifyConf, rootToml);
  //   await remove(docsToml);

  //   // Fill the meta
  //   const libPackage = await readJson(this.rootPath('lib/package.json'));
  //   const { description, name, homepage } = libPackage;
  //   const siteData = {
  //     description: description || '',
  //     title: name,
  //     productionUrl: homepage,
  //     twitter: 'pixelastic',
  //   };
  //   const dataPath = this.rootPath('docs/src/_data/meta.json');
  //   await writeJson(siteData, dataPath);

  //   const themeConfig = {
  //     navigation: [
  //       {
  //         name: 'Overview',
  //         links: [
  //           {
  //             title: 'Getting Started',
  //             href: 'gettingStarted',
  //           },
  //         ],
  //       },
  //       {
  //         name: 'API',
  //         links: ['init', 'read', 'write'],
  //       },
  //     ],
  //   };
  //   const themeConfigPath = this.rootPath('docs/src/_data/theme.json');
  //   await writeJson(themeConfig, themeConfigPath);

  //   // Define the theme
  //   const norskaConfig = dedent`
  //   const theme = require('norska-theme-docs');

  //   module.exports = {
  //     theme,
  //   }`;
  //   await write(norskaConfig, this.rootPath('docs/norska.config.js'));

  //   // Configure readme.
  //   // We move the current Readme to docs/src/index.md
  //   // We delete the main readme and ./lib readme, they will be regenerated on commit
  //   const hostReadmePath = this.rootPath('README.md');
  //   const readmeContent = _.chain(await read(hostReadmePath))
  //     .replace(`# ${name}`, '')
  //     .value();
  //   const indexContent = dedent`
  //   ---
  //   title: ${name}
  //   ---

  //   <div class="lead">${description}</div>

  //   ${readmeContent}`;
  //   await write(indexContent, this.rootPath('docs/src/index.md'));
  //   await remove(this.rootPath('docs/src/index.pug'));

  //   // Regenerate host reamde
  //   await remove(this.rootPath('README.md'));
  //   await remove(this.rootPath('lib/README.md'));
  //   await run('yarn aberlaas readme');
  // },

  // pathRoot(relativePath = '') {
  //   // just because I keep confusing the method name
  //   return this.rootPath(relativePath);
  // },
  // async initialPackage() {
  //   const filepath = path.resolve(this.rootPath('package.json'));
  //   if (!this.has('initialPackage')) {
  //     this.set('initialPackage', await readJson(filepath));
  //   }
  //   return this.get('initialPackage');
  // },
  // templatePath(relativePath = '') {
  //   return path.resolve(__dirname, 'templates', relativePath);
  // },
  // async getTemplate(relativePath = '') {
  //   return await readJson(this.templatePath(relativePath));
  // },
};
