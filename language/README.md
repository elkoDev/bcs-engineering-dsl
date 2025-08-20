[![CI](https://github.com/elkoDev/bcs-engineering-dsl/actions/workflows/ci.yml/badge.svg)](https://github.com/elkoDev/bcs-engineering-dsl/actions/workflows/ci.yml)

# 1. Setup

## 1.1 Install Dependencies

```bash
npm install
```

## 1.2 Build

```bash
npm run langium:generate && npm run build
```

## 1.3 Generate Extension

Before generating the extension, make sure to run the build commands first.

```bash
vsce package
```

## 1.4 Publish CLI

```bash
npm login
npm publish --access public
```

## 1.5 Install CLI

```bash
npm install -g bcs-engineering-dsl
```

or link the local version

```bash
npm link
```

# 2. Usage

## 2.1 Generate Code

```bash
bcs-engineering-cli beckhoff generate <path-to-bcsctrl-file>
```

## 2.2 Generate Code and Deploy

```bash
bcs-engineering-cli beckhoff deploy <path-to-bcsctrl-file>
```

**NOTE:** The working directory will be set to the root of the provided file. This means that the .bcsctrl file can contain cross-references to other files in the same directory.

## 2.3 Supported Target Platforms

Currently the following target platforms are supported:

### 2.3.1 Beckhoff TwinCAT 3

In addition to the standard libraries provided by Beckhoff, the following libraries are supported:

- `Tc3_DALI`
