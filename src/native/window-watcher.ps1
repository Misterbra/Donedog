# TaskDog — observateur de fenêtres (serveur ligne à ligne sur stdin/stdout).
# {"op":"windows"} -> liste des fenêtres visibles (rects en px physiques)
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::InputEncoding = [System.Text.Encoding]::UTF8

Add-Type -TypeDefinition @'
using System;
using System.Text;
using System.Runtime.InteropServices;
using System.Collections.Generic;

public static class TDWin {
  public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumWindowsProc cb, IntPtr lp);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr h);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern int GetWindowTextW(IntPtr h, StringBuilder sb, int max);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
  [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("dwmapi.dll")] public static extern int DwmGetWindowAttribute(IntPtr h, int attr, out int val, int size);

  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int L, T, R, B; }

  public static List<object[]> GetWindows() {
    var list = new List<object[]>();
    EnumWindows(delegate(IntPtr h, IntPtr lp) {
      if (!IsWindowVisible(h) || IsIconic(h)) return true;
      var sb = new StringBuilder(256);
      GetWindowTextW(h, sb, 256);
      string title = sb.ToString();
      if (title.Length == 0 || title == "Program Manager") return true;
      int cloaked = 0;
      try { DwmGetWindowAttribute(h, 14, out cloaked, 4); } catch {}
      if (cloaked != 0) return true;
      RECT r;
      GetWindowRect(h, out r);
      if (r.R - r.L < 220 || r.B - r.T < 160) return true;
      list.Add(new object[] { h.ToInt64(), title, r.L, r.T, r.R, r.B });
      return true;
    }, IntPtr.Zero);
    return list;
  }

  public static string GetForegroundTitle() {
    IntPtr h = GetForegroundWindow();
    if (h == IntPtr.Zero) return "";
    var sb = new StringBuilder(256);
    GetWindowTextW(h, sb, 256);
    return sb.ToString();
  }
}
'@

[TDWin]::SetProcessDPIAware() | Out-Null   # coordonnées physiques, toujours

function Reply($obj) {
  Write-Output ($obj | ConvertTo-Json -Compress -Depth 6)
}

while ($true) {
  $line = [Console]::In.ReadLine()
  if ($null -eq $line) { break }
  try {
    $cmd = $line | ConvertFrom-Json
    switch ($cmd.op) {
      'windows' {
        $arr = @([TDWin]::GetWindows() | ForEach-Object {
          @{ h = $_[0]; title = $_[1]; l = $_[2]; t = $_[3]; r = $_[4]; b = $_[5] }
        })
        Reply @{ ok = $true; fg = [TDWin]::GetForegroundTitle(); data = $arr }
      }
      default { Reply @{ ok = $false; error = 'op inconnue' } }
    }
  } catch {
    Reply @{ ok = $false; error = "$_" }
  }
}
