# TwinCAT Setup Guide

This guide covers the prerequisites and setup steps for working with TwinCAT XAE Shell 15.0.

## 1 Prerequisites

- Windows 10/11
- TwinCAT XAE Shell Version 15.0 (compatibility with other versions has not been tested)
  - **Tested Version**: TcXaeShell 15.0.34829.251 D15.9
  - **Edition**: Express
  - **Framework**: Microsoft .NET Framework 4.8.09221
- 7-day trial license (or full license)

## 2 TwinCAT Installation

1. Download and install TwinCAT XAE Shell 15.0 from [Beckhoff's website](https://www.beckhoff.com/en-en/support/download-finder/software-and-tools/)
2. Follow the installation wizard
3. Verify the installation by checking the version (Help → About in TwinCAT XAE)

### 2.1 Verified Components

The framework has been tested with the following TwinCAT components:

- **TwinCAT XAE Base**: 3.1.0.0
- **TcXaeShell**: 1.15.0
- **TcXaeHelper**: 4024.65.0.0
- **TcXaeModules**: 4024.65.0.0 (TMC Editor, TMC Code Generator)
- **TwinCAT Measurement**: 4.48.45.0
- **TwinCAT Scope**: 4.48.92.0

## 3 License Setup

TwinCAT requires a valid license to run. For development and testing purposes, you can obtain a 7-day trial license:

1. Create a new TwinCAT XAE project (File → New → Project → TwinCAT XAE Project)
2. Add a PLC project to your solution
3. Try to activate the configuration or switch to Run Mode
4. A license popup will appear automatically, offering a 7-day trial license
5. Follow the prompts to request and activate the trial license

**Note:** The 7-day trial license needs to be renewed after expiration. You can renew it by repeating the process above.

## 4 Hyper-V Compatibility Issue

TwinCAT requires direct hardware access and **does not work with Hyper-V enabled**. If you're running Windows with Hyper-V or WSL2, you need to disable it.

### 4.1 Disable Windows Core Isolation (Memory Integrity)

Windows Core Isolation with Memory Integrity can interfere with TwinCAT. You need to disable it:

1. Open Windows Security (Windows Defender)
2. Go to **Device Security** → **Core Isolation Details**
3. Turn off **Memory Integrity**
4. Restart your computer


### 4.2 Solution: Dual Boot Configuration

Instead of permanently disabling Hyper-V, you can create a dual boot option that allows you to choose whether to boot Windows with or without Hyper-V.

#### 4.2.1 Create Boot Entry (PowerShell Script)

Run the following PowerShell script **as Administrator**:

```powershell
# Get GUID of current Windows boot entry
$sourceGuid = "{current-boot-entry-guid}"  # Replace with your actual GUID
$description = "Windows 11 - No Hyper-V (TwinCAT)"

# Create new boot entry
$bcdCopyOutput = bcdedit /copy $sourceGuid /d $description

# Extract GUID
if ($bcdCopyOutput -match "\{[0-9a-fA-F\-]+\}") {
    $newGuid = $matches[0]

    # Disable Hyper-V for this boot entry
    bcdedit /set $newGuid hypervisorlaunchtype off

    # Set boot timeout (optional)
    bcdedit /timeout 5

    # Display result
    Write-Host "`n New boot entry successfully created:"
    Write-Host "   Description: $description"
    Write-Host "   GUID: $newGuid"
    Write-Host "`n Select '$description' on next boot for TwinCAT without Hyper-V."
} else {
    Write-Host " Error: Could not extract GUID."
}
```

#### 4.2.2 Find Your Current Boot GUID

To find your current Windows boot entry GUID, run the following command as Administrator in PowerShell:

```powershell
bcdedit /enum
```

Look for the entry marked as `{current}` and note its GUID.

#### 4.2.3 Result

After running the script, you'll have two boot options:

- **Windows 11** - Normal boot with Hyper-V enabled (for WSL2, Docker, etc.)
- **Windows 11 - No Hyper-V (TwinCAT)** - Boot without Hyper-V for TwinCAT development

Simply select the appropriate option when starting your computer.

## 5 Verify Installation

After setup, verify that TwinCAT is correctly installed:

1. Open TwinCAT XAE (Visual Studio Shell)
2. Check that TwinCAT system tray icon appears (orange/blue)
3. Switch to Config Mode and then Run Mode to verify functionality