const path = require('path');
const readJson = require('firost/readJson');
module.exports = {
  async get(relativePath) {
    const templatePath = path.resolve('templates', relativePath);
    return await readJson(templatePath);
  },
};
