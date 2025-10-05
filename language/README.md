[![CI](https://github.com/elkoDev/bcs-engineering-dsl/actions/workflows/ci.yml/badge.svg)](https://github.com/elkoDev/bcs-engineering-dsl/actions/workflows/ci.yml)

# BCS Engineering DSL

## 1 Publishing

### 1.1 Install Dependencies

```bash
npm install
```

### 1.2 Build

```bash
npm run langium:generate && npm run build
```

### 1.3 Generate Extension

Before generating the extension, make sure to run the build commands first.

```bash
vsce package
```

### 1.4 Publish CLI
NOTE: Previous versions have been published under the name `bcs-engineering-dsl` on my personal npm account. To avoid confusion, you might want to publish under a different name.

```bash
npm login
npm publish --access public
```

## 2 Installation

### 2.1 Install VS Code Extension

Right click on the `bcs-engineering-dsl-<version>.vsix` file and select `Install Extension VSIX`.

### 2.2 Install the CLI:

```bash
npm install -g bcs-engineering-dsl
```

or link the local version

```bash
npm link
```

## 3 Usage

### 3.1 Generate Code

```bash
bcs-engineering-cli beckhoff generate <path-to-bcsctrl-file>
```

### 3.2 Generate Code and Deploy

```bash
bcs-engineering-cli beckhoff deploy <path-to-bcsctrl-file>
```

**NOTE:** The working directory will be set to the root of the provided file. This means that the .bcsctrl file can contain cross-references to other files in the same directory.

### 3.3 Supported Target Platforms

Currently the following target platforms are supported:

#### 3.3.1 Beckhoff

In addition to the standard libraries provided by Beckhoff, the following libraries are supported:

- `Tc3_DALI`: Please note that this library integration is not fully tested.

## 4 Future Work
