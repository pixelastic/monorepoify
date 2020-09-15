const path = require('path');
const readJson = require('firost/readJson');
const writeJson = require('firost/writeJson');
const run = require('firost/run');
const read = require('firost/read');
const write = require('firost/write');
const copy = require('firost/copy');
const remove = require('firost/remove');
const isDirectory = require('firost/isDirectory');
const move = require('firost/move');
const _ = require('golgoth/lib/lodash');
const dedent = require('golgoth/lib/dedent');

module.exports = {
  async run(cliRootPath) {
    this.set('rootPath', path.resolve(cliRootPath || '.'));

    await this.prepareRoot();
    await this.prepareLib();
    await this.prepareDocs();

    await this.install();

    await this.postInstallDocs();
  },

  // Prepare the docs folder
  async prepareDocs() {
    const baseData = await this.initialPackage();
    const { name, version } = baseData;

    // Write package.json
    const template = await this.getTemplate('docs/package.json');
    template.homepage = template.homepage.replace('{name}', name);
    template.name = template.name.replace('{name}', name);
    template.version = template.version.replace('{version}', version);
    await writeJson(template, this.rootPath('docs/package.json'));
  },
  // Prepare the lib folder
  async prepareLib() {
    const baseData = await this.initialPackage();
    const { name } = baseData;
    const files = _.chain(baseData)
      .get('files')
      .map((file) => {
        return file.replace('lib/', '');
      })
      .value();
    const scripts = _.chain(baseData)
      .get('scripts')
      .transform((result, value, key) => {
        result[key] = value.replace('./scripts/', '../scripts/lib/');
      })
      .value();
    const libPackage = {
      ...baseData,
      devDependencies: undefined,
      main: 'main.js',
      files,
      scripts,
      repository: `pixelastic/${name}`,
      homepage: `https://projects.pixelastic.com/${name}/`,
    };
    await writeJson(libPackage, this.rootPath('lib/package.json'));

    // Move bin directory if available
    if (await isDirectory(this.rootPath('bin/'))) {
      await move(this.rootPath('bin/'), this.rootPath('lib/bin'));
    }
  },
  // Prepare the root
  async prepareRoot() {
    const baseData = await this.initialPackage();
    const { name, version } = baseData;

    // Write package.json
    const template = await this.getTemplate('package.json');
    template.name = template.name.replace('{name}', name);
    template.description = template.description.replace('{name}', name);
    template.homepage = template.homepage.replace('{name}', name);
    await writeJson(template, this.rootPath('package.json'));

    // Replace scripts
    await remove(this.rootPath('scripts'));
    await copy(this.templatePath('scripts'), this.rootPath('scripts'));

    // Configure lerna
    const lernaConfig = await this.getTemplate('lerna.json');
    lernaConfig.version = version;
    const lernaFinal = await this.rootPath('lerna.json');
    await writeJson(lernaConfig, lernaFinal);
  },
  // Install all dependencies
  async install() {
    // Dev dependencies
    await run('yarn install && yarn upgrade aberlaas@latest lerna@latest', {
      shell: true,
    });

    // Docs
    const docsPath = this.rootPath('docs');
    await run(
      `cd ${docsPath} && yarn upgrade norska@latest norska-theme-docs@latest && yarn install`,
      { shell: true }
    );
    await run(`cd ${docsPath} && yarn run norska init`, {
      shell: true,
      stdin: true,
    });
  },

  // Fixes after install
  async postInstallDocs() {
    // Update netlify.toml
    const docsToml = this.rootPath('./docs/netlify.toml');
    const rootToml = this.rootPath('./netlify.toml');
    let netlifyConf = await read(docsToml);
    netlifyConf = netlifyConf.replace('"./dist/"', '"./docs/dist"');
    await write(netlifyConf, rootToml);
    await remove(docsToml);

    // Fill the meta
    const libPackage = await readJson(this.rootPath('lib/package.json'));
    const { description, name, homepage } = libPackage;
    const siteData = {
      defaultDescription: description,
      defaultTitle: name,
      defaultUrl: homepage,
      defaultAuthor: 'Tim Carry',
      defaultTwitter: 'pixelastic',
    };
    const dataPath = this.rootPath('docs/src/_data/site.json');
    await writeJson(siteData, dataPath);

    const themeConfig = {
      navigation: [
        {
          name: 'Overview',
          links: [
            {
              title: 'Getting Started',
              href: 'gettingStarted',
            },
          ],
        },
        {
          name: 'API',
          links: ['init', 'read', 'write'],
        },
      ],
    };
    const themeConfigPath = this.rootPath('docs/src/_data/theme.json');
    await writeJson(themeConfig, themeConfigPath);

    // Define the theme
    const norskaConfig = dedent`
    const theme = require('norska-theme-docs');

    module.exports = {
      theme,
    }`;
    await write(norskaConfig, this.rootPath('docs/norska.config.js'));

    // Set the readme as the default index page
    const readmeContent = await read(this.rootPath('README.md'));
    const indexContent = dedent`
    ---
    title: ${name}
    ---

    ${readmeContent}`;
    await write(indexContent, this.rootPath('docs/src/index.md'));
    await remove(this.rootPath('docs/src/index.pug'));
  },

  // Helper functions
  cache: {},
  get(key) {
    return _.get(this.cache, key);
  },
  set(key, value) {
    _.set(this.cache, key, value);
  },
  has(key) {
    return _.has(this.cache, key);
  },
  rootPath(relativePath = '') {
    return path.resolve(this.get('rootPath'), relativePath);
  },
  pathRoot(relativePath = '') {
    // just because I keep confusing the method name
    return this.rootPath(relativePath);
  },
  async initialPackage() {
    const filepath = path.resolve(this.rootPath('package.json'));
    if (!this.has('initialPackage')) {
      this.set('initialPackage', await readJson(filepath));
    }
    return this.get('initialPackage');
  },
  templatePath(relativePath = '') {
    return path.resolve(__dirname, 'templates', relativePath);
  },
  async getTemplate(relativePath = '') {
    return await readJson(this.templatePath(relativePath));
  },
};
