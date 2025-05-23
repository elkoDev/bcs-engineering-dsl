# bcs-engineering-dsl

## 1. Prerequisites

- Windows with TcXaeShell Version 15.0 or higher

## 2. Example

To run the example in the folder [language/example](language/example), you need to follow the following steps.

### 2.1 Generate the artifacts
For this follow the installation instructions in the [bcs-engineering-dsl](language/README.md) README file.

### 2.2 Install TcAutomation

_TcAutomation_ is responsible for the creation of the corresponding TwinCAT project given the generated artifacts. To install it, you need to run the `TcAutomationInstaller.exe`.
To create the installer, follow the steps described in the [TcAutomation](TcAutomation/README.md) README file.

### 2.3 Check TcAutomation Installation

To check if _TcAutomation_ is installed correctly, you can run the following command in a command prompt:

```bash
TcAutomation --workspace <YOUR PATH TO THE CLONED REPO>\bcs-engineering-dsl\language
```

This command should return the following output:

```bash
Solution created.
Project added from template.
✅ PLC project 'MyPlcProject' created successfully.
✅ Task cycle time successfully set to 10ms.
✅ Library 'Tc3_DALI' added successfully.
✅ Created Enum 'OperatingMode' with optional texts.
✅ Created Struct 'Temperatures' with optional texts.
✅ Created FunctionBlock 'HeatingLogic' with optional texts.
✅ Main PLC object set with optional texts.
✅ TwinCAT configuration activated.
✅ TwinCAT restarted.
✅ TwinCAT project saved.
✅ TwinCAT project closed.
```
