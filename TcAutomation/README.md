# TcAutomation Deployment Tool

## 1 Prerequisites

- [Inno Setup](https://jrsoftware.org/isinfo.php)

## 2 Build Project

```bash
msbuild /p:Configuration=Release TcAutomation.csproj
```

## 3 Create Installer

- Open the [TcAutomationInstaller.iss](TcAutomationInstaller.iss) file within the Inno Setup.
- Click the "Build/Compile" button (or press Ctrl+F9)."
- The installer will be created in the [output](output) folder.
