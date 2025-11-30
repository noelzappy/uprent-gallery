# Installation

1. Install [Bun](https://bun.sh/docs/installation) (v1.2.x) on your system
2. Run `bun i` in the project root

Done!

## Overview

This is a monorepo, that consists of several apps & packages.

Apps are isolated projects (meaning you cannot use code from `server` in `web`, for example).

Packages contain shared code, that can be used in any app.

## Scripts

Each app has several scripts that you can use. To use them, `cd` into the app directory and then run `bun run <script name>`

### `lint`
This script runs TypeScript checks. Everything is already configured, so it should just work!

### `dev`
Runs the app. Watches for file changes, and reloads the app automatically.

----

##### There are also two special scripts available in the root of the project:

### `lint:all`
Just a helper that runs all `lint` scripts, as well as checks code formatting
