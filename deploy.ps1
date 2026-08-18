[CmdletBinding()]
param(
    [switch] $DryRun,
    [switch] $SkipInstall,
    [switch] $Yes
)

$ErrorActionPreference = 'Stop'

$ExpectedBranch = 'master'
$Server = 'infomaniak'
$RemoteDirectory = 'sites/new.infovegetal.com'
$RemoteRepository = '../../git/new.infovegetal.com'

function Format-Command {
    param(
        [string] $Executable,
        [string[]] $Arguments
    )

    $formattedArguments = $Arguments | ForEach-Object {
        if ($_ -match '[\s`"'']') {
            '"{0}"' -f ($_ -replace '"', '\"')
        }
        else {
            $_
        }
    }

    $parts = @($Executable) + @($formattedArguments)
    return ($parts -join ' ').Trim()
}

function Invoke-DeploymentCommand {
    param(
        [string] $Title,
        [string] $Executable,
        [string[]] $Arguments
    )

    Write-Host "`n==> $Title" -ForegroundColor Cyan
    Write-Host (Format-Command -Executable $Executable -Arguments $Arguments) -ForegroundColor DarkGray

    if ($DryRun) {
        return
    }

    & $Executable @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "Echec de l'etape : $Title"
    }
}

function Invoke-GitCapture {
    param([string[]] $Arguments)

    $output = & git @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "La commande git a echoue : git $($Arguments -join ' ')"
    }

    return ($output | Out-String).Trim()
}

Push-Location -LiteralPath $PSScriptRoot

try {
    foreach ($executable in @('git', 'npm', 'composer', 'php', 'ssh', 'scp')) {
        if (-not (Get-Command $executable -ErrorAction SilentlyContinue)) {
            throw "Commande introuvable : $executable"
        }
    }

    $repositoryRoot = Invoke-GitCapture -Arguments @('rev-parse', '--show-toplevel')
    $scriptRoot = (Resolve-Path -LiteralPath $PSScriptRoot).Path
    if ([System.IO.Path]::GetFullPath($repositoryRoot) -ne [System.IO.Path]::GetFullPath($scriptRoot)) {
        throw "deploy.ps1 doit se trouver a la racine du depot Git."
    }

    $currentBranch = Invoke-GitCapture -Arguments @('branch', '--show-current')
    if ($currentBranch -ne $ExpectedBranch) {
        throw "Branche courante : '$currentBranch'. Le deploiement doit partir de '$ExpectedBranch'."
    }

    $localChanges = Invoke-GitCapture -Arguments @('status', '--porcelain')
    if ($localChanges) {
        Write-Host $localChanges
        throw 'Le depot local contient des modifications non validees.'
    }

    $startingCommit = Invoke-GitCapture -Arguments @('rev-parse', '--short', 'HEAD')
    Write-Host "Depot propre sur $ExpectedBranch ($startingCommit)." -ForegroundColor Green

    if (-not $DryRun -and -not $Yes) {
        $confirmation = Read-Host 'Lancer le deploiement ? [o/N]'
        if ($confirmation -notin @('o', 'O', 'oui', 'OUI', 'y', 'Y', 'yes', 'YES')) {
            Write-Host 'Deploiement annule.' -ForegroundColor Yellow
            return
        }
    }

    Invoke-DeploymentCommand -Title 'Recuperation de origin/master' `
        -Executable 'git' -Arguments @('fetch', 'origin', 'master')

    Invoke-DeploymentCommand -Title 'Mise a jour locale en fast-forward' `
        -Executable 'git' -Arguments @('merge', '--ff-only', 'origin/master')

    if (-not $SkipInstall) {
        Invoke-DeploymentCommand -Title 'Installation des dependances JavaScript' `
            -Executable 'npm' -Arguments @('ci')

        Invoke-DeploymentCommand -Title 'Installation des dependances PHP locales' `
            -Executable 'composer' -Arguments @('install', '--no-interaction')
    }

    Invoke-DeploymentCommand -Title 'Generation de Wayfinder' `
        -Executable 'php' -Arguments @('artisan', 'wayfinder:generate', '--with-form')

    Invoke-DeploymentCommand -Title 'Construction des assets' `
        -Executable 'npm' -Arguments @('run', 'build')

    Write-Host "`n==> Suppression eventuelle de public/hot" -ForegroundColor Cyan
    if ($DryRun) {
        Write-Host 'Remove-Item -LiteralPath public/hot -Force (si le fichier existe)' -ForegroundColor DarkGray
    }
    elseif (Test-Path -LiteralPath 'public/hot') {
        Remove-Item -LiteralPath 'public/hot' -Force
    }

    Invoke-DeploymentCommand -Title 'Envoi de master vers production' `
        -Executable 'git' -Arguments @('push', 'production', 'master')

    $remoteCommand = @'
set -eu
cd '__REMOTE_DIRECTORY__'

dirty="$(git status --porcelain)"
if [ -n "$dirty" ]; then
    echo "Le depot serveur contient des modifications locales :" >&2
    git status --short >&2
    exit 1
fi

git pull --no-edit '__REMOTE_REPOSITORY__' master
rm -f public/hot
/opt/php8.3/bin/composer install --no-dev --optimize-autoloader --no-interaction
/opt/php8.3/bin/php artisan migrate --force
/opt/php8.3/bin/php artisan optimize:clear
/opt/php8.3/bin/php artisan optimize
'@
    $remoteCommand = $remoteCommand.Replace('__REMOTE_DIRECTORY__', $RemoteDirectory)
    $remoteCommand = $remoteCommand.Replace('__REMOTE_REPOSITORY__', $RemoteRepository)

    Invoke-DeploymentCommand -Title 'Mise a jour de Laravel sur le serveur' `
        -Executable 'ssh' -Arguments @($Server, $remoteCommand)

    Invoke-DeploymentCommand -Title 'Copie de public/build vers le serveur' `
        -Executable 'scp' -Arguments @('-r', 'public/build', "${Server}:${RemoteDirectory}/public/")

    if ($DryRun) {
        Write-Host "`nSimulation terminee : aucune etape de deploiement n'a ete executee." -ForegroundColor Green
    }
    else {
        $deployedCommit = Invoke-GitCapture -Arguments @('rev-parse', '--short', 'HEAD')
        Write-Host "`nDeploiement termine : commit $deployedCommit." -ForegroundColor Green
    }
}
finally {
    Pop-Location
}
