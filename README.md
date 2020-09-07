# monorepoify

This repository holds a local script I have been using to transform repositories
I have into monorepos. It create a `./lib` and `./docs` folder with their own
dependencies using lerna and yarn workspaces.

I didn't release it as a module as I expect to be using it only a handful of
times, and don't expect anyone else to need it as it's pretty tied to the way
**I** organize my files.

Still, having it in a script on GitHub allows me to revert to previous versions
in case of bugs, use modules and document the process.

