[CmdletBinding()]
param(
    [string] $ProdPath = 'D:\clients\infovegetal.prod',
    [switch] $DryRun,
    [switch] $SkipInstall
)

# Full deployment launched from the dev clone, without touching the dev server:
#   1. dev clone: must be clean on master, then git push origin master
#   2. prod clone: fast-forward to origin/master, then sync the git-ignored deploy.ps1 from dev
#   3. prod clone: run deploy.ps1 (build, push production, migrate, scp)
# Exit code 3 = SSH passphrase required (see deploy.ps1).

$ErrorActionPreference = 'Stop'

function Invoke-Git {
    param([string] $Repository, [string[]] $Arguments)
    # PS 5.1: redirected native stderr must not become a terminating error.
    $ErrorActionPreference = 'Continue'

    $output = & git -C $Repository @Arguments 2>&1 | ForEach-Object { "$_" }
    if ($LASTEXITCODE -ne 0) {
        throw "git $($Arguments -join ' ') a echoue dans $Repository :`n$($output | Out-String)"
    }

    return ($output | Out-String).Trim()
}

$DevPath = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path

if (-not (Test-Path -LiteralPath (Join-Path $ProdPath 'deploy.ps1'))) {
    throw "Clone de deploiement introuvable : $ProdPath"
}

# The prod clone may belong to another Windows account (e.g. after a reinstall).
$ErrorActionPreference = 'Continue'
& git -C $ProdPath rev-parse --show-toplevel 2>$null | Out-Null
$ErrorActionPreference = 'Stop'
if ($LASTEXITCODE -ne 0) {
    $safePath = $ProdPath -replace '\\', '/'
    Write-Host "==> Ajout de $safePath a safe.directory" -ForegroundColor Cyan
    & git config --global --add safe.directory $safePath
}

Write-Host "==> Depot de dev : $DevPath" -ForegroundColor Cyan
$branch = Invoke-Git $DevPath @('branch', '--show-current')
if ($branch -ne 'master') {
    throw "Le depot de dev est sur '$branch' : le deploiement part de master."
}
$changes = Invoke-Git $DevPath @('status', '--porcelain')
if ($changes) {
    Write-Host $changes
    throw 'Le depot de dev contient des modifications non commitees.'
}

if ($DryRun) {
    Write-Host 'git push origin master (simulation)' -ForegroundColor DarkGray
}
else {
    Write-Host '==> git push origin master' -ForegroundColor Cyan
    Invoke-Git $DevPath @('push', 'origin', 'master') | Write-Host
}

Write-Host "==> Mise a jour du clone de deploiement : $ProdPath" -ForegroundColor Cyan
Invoke-Git $ProdPath @('fetch', 'origin', 'master') | Out-Null
Invoke-Git $ProdPath @('merge', '--ff-only', 'origin/master') | Write-Host

# deploy.ps1 is git-ignored: the dev copy is the reference, sync it to the prod clone.
Copy-Item -LiteralPath (Join-Path $DevPath 'deploy.ps1') -Destination (Join-Path $ProdPath 'deploy.ps1') -Force
Write-Host '==> deploy.ps1 synchronise depuis le dev' -ForegroundColor Cyan

$deployArgs = @{ Yes = $true }
if ($DryRun) { $deployArgs.DryRun = $true }
if ($SkipInstall) { $deployArgs.SkipInstall = $true }

& (Join-Path $ProdPath 'deploy.ps1') @deployArgs
exit $LASTEXITCODE
