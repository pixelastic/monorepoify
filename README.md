# monorepoify

⚠ This module is not meant to be used by anything but me.

Run `monorepoify` in any directory holding a library created by `aberlaas init`,
and it will automatically modify the structure to add a `./docs` and `./lib`
subfolders.

The `./lib` subfolder will contain the actual code of the module.

The `./docs` subfolder will contain a documentation website made with `norska`
and `norska-theme-docs`.

The root will contain the Yarn workspaces and lerna configuration to handle this
monorepo setup.

