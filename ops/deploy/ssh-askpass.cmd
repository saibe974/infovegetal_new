@echo off
rem SSH_ASKPASS helper used by deploy.ps1 (Windows OpenSSH).
rem Prints the SSH key passphrase from DEPLOY_SSH_PASSPHRASE, or else from the
rem DPAPI-encrypted file %USERPROFILE%\.ssh\infomaniak.pass (current Windows account only).
powershell -NoProfile -NonInteractive -Command "if ($env:DEPLOY_SSH_PASSPHRASE) { [Console]::Out.Write($env:DEPLOY_SSH_PASSPHRASE); exit 0 }; $f = Join-Path $env:USERPROFILE '.ssh\infomaniak.pass'; if (Test-Path $f) { try { $s = (Get-Content -Raw $f).Trim() | ConvertTo-SecureString -ErrorAction Stop; [Console]::Out.Write([System.Net.NetworkCredential]::new('', $s).Password) } catch { exit 1 } }"
