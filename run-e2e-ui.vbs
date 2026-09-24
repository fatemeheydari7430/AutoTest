Option Explicit

Dim shell, fso, projectDir, command

Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

projectDir = fso.GetParentFolderName(WScript.ScriptFullName)
shell.CurrentDirectory = projectDir

If Not fso.FileExists(fso.BuildPath(projectDir, "package.json")) Then
    MsgBox "package.json not found in:" & vbCrLf & projectDir, 16, "Lookinsure Tests"
    WScript.Quit 1
End If

command = "cmd /c npm run test:e2e:ui"

shell.Run command, 0, False
