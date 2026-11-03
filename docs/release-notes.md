# DoneDog for Windows

A free desktop companion with tasks, focus timers, freelance mission tracking,
and French / English voices. No account required. Source code under the MIT license.

## Download

- **Installer (.exe):** download and open it to install DoneDog.
- **Standalone ZIP (.zip):** download, choose **Extract all**, then launch **DoneDog.exe**
  from the extracted folder. Keep the other files alongside it. No installation needed.
- **SHA256SUMS.txt:** checksums for both downloads.

Windows x64 only. Both editions save data in `%APPDATA%\taskdog` and share the
same tasks and settings. The ZIP is installation-free; it does not keep data on a USB drive.
The binaries are not digitally signed, so Windows may show an unknown-publisher warning.

## Included

- Tasks, timers, work sessions, CSV export, custom face and adjustable presence.
- 33 bundled voice clips in each language, usable without an API key.
- Automatic recovery from a previous valid JSON backup, preservation of damaged files,
  and a visible retry action if saving fails.
- Updated Electron runtime, restricted navigation and bounded network requests.

GitHub Actions builds and tests both downloads, including the PowerShell window
detector inside the extracted ZIP, before publishing them here.
