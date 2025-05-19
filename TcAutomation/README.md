# Build

```bash
msbuild /p:Configuration=Release TcAutomation.csproj
```

# Windows Installer

## Pre-requisites
- Build the project in Release mode.
- [Inno Setup](https://jrsoftware.org/isinfo.php)

## Build
- Open the `TcAutomation.iss` file in Inno Setup.
- Click the "Build/Compile" button (or press Ctrl+F9)."
- The installer will be created in the `output` folder.