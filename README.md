# BCS Engineering Framework

## 1 Prerequisites

- Windows with TcXaeShell Version 15.0 or higher

## 2 Installation

To install the complete framework, you need to install three components:

1. VS Code extension: `BCS Engineering DSL`
2. `bcs-engineering-cli` - The CLI to generate the artifacts from the DSL files.
3. `TcAutomation` - The tool to create and deploy the TwinCAT project from the generated artifacts.

### 2.1 Install bcs-engineering-cli and VS Code Extension

To install the `bcs-engineering-cli` and `BCS Engineering DSL` VS Code extension, follow the installation and usage instructions in the [README](language/README.md) file.

### 2.2 Install TcAutomation

_TcAutomation_ is responsible for the creation and deployment of the corresponding TwinCAT project given the generated artifacts. To install it, you need to run the `TcAutomationInstaller.exe`.
To create the installer, follow the steps described in the [TcAutomation](TcAutomation/README.md) README file.

#### Check TcAutomation Installation

To check if _TcAutomation_ is installed correctly, you can run the following command in a command:

```bash
TcAutomation --help
```

## 3 Usage

After installation, explore the [example](language/example) folder to get started with the framework. The examples demonstrate how to define control logic and hardware configurations using the BCS Engineering DSL. You can either generate some of the artifacts (ST and TwinCAT config files) without deployment or generate and deploy them to a Beckhoff device.

#### 3.1 Generate

To generate the artifacts, you can run the following command in the `language/example` directory:

```bash
bcs-engineering-cli beckhoff generate .\kBus\control.bcsctrl
```

#### 3.2 Deploy

To generate and deploy the artifacts, you can run the following command in the `language/example` directory:

```bash
bcs-engineering-cli beckhoff deploy .\kBus\control.bcsctrl
```

You should see the following output:

```bash
Generated for Beckhoff:
  • kBus\generated\MAIN_decl.st
  • kBus\generated\MAIN_impl.st
  • kBus\generated\Enums\OperatingMode.st
  • kBus\generated\Structs\Temperatures.st
  • kBus\generated\FunctionBlocks\HeatingLogic_decl.st
  • kBus\generated\FunctionBlocks\HeatingLogic_impl.st
  • kBus\generated\tc-config.json

Deploying to Beckhoff…
[beckhoff] C:\Program Files (x86)\bcs-twincat\TcAutomation.exe --workspace C:\Users\elias\mscRepos\bcs-engineering-dsl\language\example\kBus --solution-name MyGeneratedSolution --project-name MyTwinCATProject --plc-name MyPlcProject --ads-username Administrator --ads-password 1
✅ Solution created.
Project added from template.
✅ PLC project 'MyPlcProject' created.
✅ Library 'Tc2_Utilities' added.
✅ Created Enum 'OperatingMode'.
✅ Created Struct 'Temperatures'.
✅ Created FunctionBlock 'HeatingLogic'.
✅ Main PLC object set.
✅ Linked PLC instance with 'MainPlcTask'.
Setting up ADS route for target 169.254.225.85...
        - Found device: CX-301714 (NetId: 5.48.23.20.1.1)
        - Added ADS route: Route_CX-301714 -> 169.254.225.85 (5.48.23.20.1.1)
        - Set target NetId: 5.48.23.20.1.1
✅ ADS route and target NetId successfully configured for CX-301714
Creating KBus topology for bus 'FieldBus'...
        - Created KBus master: CX8190 (Type: CX8190)
                - Found terminal coupler: Box 1 (CX-BK)
                - Processing terminals from box: TerminalBlock
                        - Created terminal: Term 1 (KL1002)
                        - Created terminal: Term 2 (KL2622)
                        - Created terminal: Term 3 (KL3044)
                        - Created terminal: Term 4 (KL4004)
                        - Skipped KL9010 end terminal (automatically created)
✅ KBus I/O topology created.
        - Scanning for online devices to update address information...
                - Updated address information for device: CX8190
✅ TcShell popup closed.
        - Linked UltrasonicSensor_Distance_Value to TIID^CX8190^Box 1 (CX-BK)^Term 3 (KL3044)^Channel 1^Data In
        - Linked UltrasonicSensor_Distance_State to TIID^CX8190^Box 1 (CX-BK)^Term 3 (KL3044)^Channel 1^State
        - Linked Temperatures_Room1_Value to TIID^CX8190^Box 1 (CX-BK)^Term 3 (KL3044)^Channel 2^Data In
        - Linked Temperatures_Room1_State to TIID^CX8190^Box 1 (CX-BK)^Term 3 (KL3044)^Channel 2^State
        - Linked Temperatures_Room2_Value to TIID^CX8190^Box 1 (CX-BK)^Term 3 (KL3044)^Channel 3^Data In
        - Linked Temperatures_Room2_State to TIID^CX8190^Box 1 (CX-BK)^Term 3 (KL3044)^Channel 3^State
        - Linked Temperatures_Room3_Value to TIID^CX8190^Box 1 (CX-BK)^Term 3 (KL3044)^Channel 4^Data In
        - Linked Temperatures_Room3_State to TIID^CX8190^Box 1 (CX-BK)^Term 3 (KL3044)^Channel 4^State
        - Linked Buttons_Room1 to TIID^CX8190^Box 1 (CX-BK)^Term 1 (KL1002)^Channel 1^Input
        - Linked Buttons_Room2 to TIID^CX8190^Box 1 (CX-BK)^Term 1 (KL1002)^Channel 2^Input
        - Linked Lights_Room1 to TIID^CX8190^Box 1 (CX-BK)^Term 2 (KL2622)^Channel 1^Output
        - Linked Lights_Room2 to TIID^CX8190^Box 1 (CX-BK)^Term 2 (KL2622)^Channel 2^Output
        - Linked TemperatureSetpoints_Room1Value to TIID^CX8190^Box 1 (CX-BK)^Term 4 (KL4004)^Channel 1^Data Out
        - Linked TemperatureSetpoints_Room1Ctrl to TIID^CX8190^Box 1 (CX-BK)^Term 4 (KL4004)^Channel 1^Ctrl
        - Linked TemperatureSetpoints_Room2Value to TIID^CX8190^Box 1 (CX-BK)^Term 4 (KL4004)^Channel 2^Data Out
        - Linked TemperatureSetpoints_Room2Ctrl to TIID^CX8190^Box 1 (CX-BK)^Term 4 (KL4004)^Channel 2^Ctrl
✅ Variables linked to hardware configuration.
✅ TwinCAT configuration activated.
✅ TwinCAT restarted.
✅ TwinCAT project saved.
✅ Beckhoff deployment complete.
```
