# Downloads
This NodeJS Website Generates East-To-Use `.zip` files for server admins to install BentoBox in just a few clicks!

## Accessing Data
### Releases
The Tool Accesses Github to download Releases, and updates its cache once every 6 minutes, to provide a very up-to-date mirror for github.
### Dev Builds
The Tool (Will) Access BentoBoxWorld's CI to download / mirror Development builds, for Ease of Use aswell.

## Adding an Addon
To add an addon, simply go to the [config.json](https://github.com/BentoBoxWorld/Downloads/blob/develop/config.json) file, and following the Addon/Gamemode format, add your addon. use `\n` for returns.

## Running
This tool has both a web API, and a (static) React-Based Website. To Build the Static website, and generate the Web / API Server, you must do the following:
 1) Install [NodeJS](https://nodejs.org/en/download/package-manager/)
 2) Install Yarn via `npm i -g yarn`
 3) Run `yarn` in the directory of the website, to build dependancies
 4) (Optional, if build fails) Run `yarn add sqlite3` to install SQLite3
 5) Run `yarn build` to build the web server, API, and Static website
 6) Run `yarn start` to host the website on port 8080

### Other:
`yarn  site` - Rebuilds (in Dev mode) Site Only, and Hosts

`yarn dev` - Rebuilds (in Dev mode) Everything, and Hosts

## Credit:
Based on [BentoBoxWorld/Website](https://github.com/BentoBoxWorld/Website) by [Mastercake](https://github.com/mastercake10)

Build by [Fredthedoggy](https://github.com/fredthedoggy)
