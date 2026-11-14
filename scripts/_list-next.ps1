$procs = Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" |
  Where-Object { $_.CommandLine -match 'next dev|turbopack' }
if ($procs) {
  $procs | ForEach-Object {
    Write-Output ("PID {0}: {1}" -f $_.ProcessId, $_.CommandLine.Substring(0, [Math]::Min(120, $_.CommandLine.Length)))
  }
} else {
  Write-Output "no next dev processes"
}
