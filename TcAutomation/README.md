# TcAutomation Deployment Tool

## 1 Prerequisites

- [Inno Setup](https://jrsoftware.org/isinfo.php)
- TwinCAT XAE Shell 15.0 properly installed and configured (see [TwinCAT Setup Guide](TWINCAT_SETUP.md))

## 2 Build Project

```bash
msbuild /p:Configuration=Release TcAutomation.csproj
```

## 3 Create Installer

- Open the [TcAutomationInstaller.iss](TcAutomationInstaller.iss) file within the Inno Setup.
- Click the "Build/Compile" button (or press Ctrl+F9)."
- The installer will be created in the [output](output) folder.

## 4 CLI Usage

**Note:** You typically don't call `TcAutomation.exe` directly. Instead, use the BCS Engineering DSL CLI tool:

```bash
bcs-engineering-cli beckhoff deploy <file>
```

The `deploy` command internally invokes `TcAutomation.exe` with the appropriate parameters. However, if you need to call it manually, the following options are available:

### Command Line Options

| Option            | Required | Default                                                             | Description                                        |
| ----------------- | -------- | ------------------------------------------------------------------- | -------------------------------------------------- |
| `--workspace`     | Yes      | -                                                                   | Path to your project root (where generated/ lives) |
| `--solution-name` | No       | `MyGeneratedSolution`                                               | Name of the TwinCAT solution                       |
| `--project-name`  | No       | `MyTwinCATProject`                                                  | Name of the Visual Studio project                  |
| `--plc-name`      | No       | `MyPlcProject`                                                      | PLC project name                                   |
| `--template-path` | No       | `C:\TwinCAT\3.1\Components\Base\PrjTemplate\TwinCAT Project.tsproj` | Path to your .tsproj template                      |
| `--prog-id`       | No       | `TcXaeShell.DTE.15.0`                                               | ProgID to use when launching TwinCAT               |
| `--ads-username`  | No       | `Administrator`                                                     | ADS username for remote connection                 |
| `--ads-password`  | No       | `1`                                                                 | ADS password for remote connection                 |

**Note:** If you're using a different TwinCAT version, you need to adjust the `--prog-id` parameter accordingly.

### Example Usage

```bash
TcAutomation.exe --workspace "C:\Projects\MyProject"
```

```bash
TcAutomation.exe --workspace "C:\Projects\MyProject" --solution-name "MySolution" --plc-name "MainPLC"
```
