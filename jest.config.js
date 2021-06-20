const config = require('aberlaas/lib/configs/jest.js');
module.exports = {
  ...config,
  modulePathIgnorePatterns: ['<rootDir>/tmp', '<rootDir>/fixtures'],
};
