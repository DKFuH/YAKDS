param(
  [string]$Root = (Join-Path $PSScriptRoot '..'),
  [int]$PollSeconds = 8
)

$ErrorActionPreference = 'Stop'

$rootPath = (Resolve-Path $Root).Path
$queueDir = Join-Path $rootPath '.agent-sprint-queue'
$doneDir = Join-Path $queueDir 'done'
$failedDir = Join-Path $queueDir 'failed'
$logFile = Join-Path $rootPath '.agent-sprint-runner.log'

New-Item -ItemType Directory -Force -Path $queueDir | Out-Null
New-Item -ItemType Directory -Force -Path $doneDir | Out-Null
New-Item -ItemType Directory -Force -Path $failedDir | Out-Null
if (-not (Test-Path $logFile)) { '' | Out-File -FilePath $logFile -Encoding utf8 }

function Write-Log([string]$msg) {
  try {
    Add-Content -Path $logFile -Value "$(Get-Date -Format o) $msg" -ErrorAction Stop
  } catch {
    # avoid hard-fail when file is temporarily locked by another process
  }
}

Write-Log "Runner started. Queue=$queueDir PollSeconds=$PollSeconds"

while ($true) {
  try {
    $jobs = Get-ChildItem -Path $queueDir -Filter '*.json' -File | Sort-Object LastWriteTimeUtc

    foreach ($job in $jobs) {
      try {
        $payload = Get-Content -Path $job.FullName -Raw -Encoding UTF8 | ConvertFrom-Json
        $sprintFile = [string]$payload.sprint_file
        $sprintName = [string]$payload.sprint_name

        if (-not (Test-Path $sprintFile)) {
          Write-Log "SKIP missing sprint file: $sprintFile"
          Move-Item -Force -Path $job.FullName -Destination (Join-Path $failedDir $job.Name)
          continue
        }

        $prompt = @"
You are implementing a sprint in the current workspace.
Read $sprintFile and execute the sprint instructions end-to-end in this repository with minimal, production-quality changes.
Respect existing architecture and coding style.
Run relevant tests for changed areas.
Update ROADMAP status as requested in the sprint file.
Do not create commits or PRs.
Return a concise summary of files changed, tests run, and any blockers.
"@

        Write-Log "START $sprintName ($sprintFile)"

        # NOTE:
        # This runner is a queue bridge that records trigger events.
        # The actual subagent call is performed by Copilot in-chat when it sees new queue items.
        # We persist a run request marker file for visibility.
        $runRequest = [ordered]@{
          created_at = (Get-Date).ToUniversalTime().ToString('o')
          type = 'subagent_request'
          sprint_name = $sprintName
          sprint_file = $sprintFile
          prompt = $prompt
        }
        $requestPath = Join-Path $rootPath (".agent-subagent-request-" + $sprintName + '-' + [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds() + '.json')
        ($runRequest | ConvertTo-Json -Depth 6) | Out-File -FilePath $requestPath -Encoding utf8

        Write-Log "REQUEST_WRITTEN $requestPath"
        Move-Item -Force -Path $job.FullName -Destination (Join-Path $doneDir $job.Name)
      } catch {
        Write-Log "JOB_FAILED $($job.Name): $($_.Exception.Message)"
        Move-Item -Force -Path $job.FullName -Destination (Join-Path $failedDir $job.Name)
      }
    }
  } catch {
    Write-Log "ERROR loop failed: $($_.Exception.Message)"
  }

  Start-Sleep -Seconds $PollSeconds
}
