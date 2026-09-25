param(
  [string]$Name = "Lookinsure Tests"
)

$root = Split-Path -Parent $PSScriptRoot
$target = Join-Path $root "run-control-center.bat"
$desktop = [Environment]::GetFolderPath("Desktop")
$shortcutPath = Join-Path $desktop "$Name.lnk"

if (-not (Test-Path -LiteralPath $target)) {
  throw "Launcher not found: $target"
}

$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = $target
$shortcut.WorkingDirectory = $root
$shortcut.Description = "Lookinsure QA Control Center"
$shortcut.IconLocation = "$env:SystemRoot\System32\shell32.dll,167"
$shortcut.Save()

Write-Output "Shortcut created: $shortcutPath"
