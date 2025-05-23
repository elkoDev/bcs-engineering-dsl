[Setup]
AppName=BCS TwinCAT Automation Tool
AppVersion=1.0.0
DefaultDirName={autopf}\bcs-twincat
DefaultGroupName=BCS Engineering Tools
OutputDir=output
OutputBaseFilename=TcAutomationInstaller
Compression=lzma
SolidCompression=yes
PrivilegesRequired=admin

[Files]
Source: "bin\Release\net9.0\*"; DestDir: "{app}"; Flags: recursesubdirs createallsubdirs ignoreversion

[Icons]
Name: "{group}\TcAutomation (CLI)"; Filename: "{app}\TcAutomation.exe"
Name: "{group}\Uninstall TcAutomation"; Filename: "{uninstallexe}"

[Run]
Filename: "{app}\TcAutomation.exe"; Description: "Run TcAutomation"; Flags: postinstall nowait skipifdoesntexist

[Code]
procedure AddToSystemPath();
var
  oldPath, newPath: string;
  needsUpdate: Boolean;
begin
  // Read the current PATH from the system environment
  if RegQueryStringValue(HKEY_LOCAL_MACHINE,
    'SYSTEM\CurrentControlSet\Control\Session Manager\Environment', 'Path', oldPath) then
  begin
    // Avoid duplicating entries
    if Pos(ExpandConstant('{app}'), oldPath) = 0 then
    begin
      newPath := oldPath + ';' + ExpandConstant('{app}');
      needsUpdate := True;
    end;
  end
  else
  begin
    // If registry read fails, initialize with only our path
    newPath := ExpandConstant('{app}');
    needsUpdate := True;
  end;

  // Update the registry
  if needsUpdate then
  begin
    RegWriteStringValue(HKEY_LOCAL_MACHINE,
      'SYSTEM\CurrentControlSet\Control\Session Manager\Environment', 'Path', newPath);
  end;
end;

procedure CurStepChanged(CurStep: TSetupStep);
begin
  if CurStep = ssPostInstall then
  begin
    AddToSystemPath();
  end;
end;
