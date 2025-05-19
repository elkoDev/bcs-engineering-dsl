[![CI](https://github.com/elkoDev/bcs-engineering-dsl/actions/workflows/ci.yml/badge.svg)](https://github.com/elkoDev/bcs-engineering-dsl/actions/workflows/ci.yml)

# Important Commands

## Install Dependencies

```bash
npm install
```

## Build

```bash
npm run langium:generate
npm run build
npm link
```

## Generate Extension

Before generating the extension, make sure to run the build commands first.

```bash
vsce package
```

## Generate Code

The code generation is done by the `bcs-engineering-dsl` CLI. The command is as follows:

```bash
node .\bin\cli.js generate .\example\control.bcsctrl
```

# Supported Target Platforms

## Beckhoff TwinCAT 3

In addition to the standard libraries provided by Beckhoff, the following libraries are supported:

- `Tc3_DALI`
