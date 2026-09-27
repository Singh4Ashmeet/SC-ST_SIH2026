# Yojana Setu - Bidirectional Repository Sync Script
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host " Syncing Yojana Setu Repositories (Git)   " -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

# Ensure both remotes exist
$remotes = git remote
if ($remotes -notcontains "origin") {
    git remote add origin https://github.com/Singh4Ashmeet/SC-ST_SIH2026.git
}
if ($remotes -notcontains "aditya") {
    git remote add aditya https://github.com/adityamittal9012/YOJANA-SETU.git
}

Write-Host ">>> Fetching from Singh4Ashmeet/SC-ST_SIH2026 (origin)..." -ForegroundColor Yellow
git fetch origin master

Write-Host ">>> Fetching from adityamittal9012/YOJANA-SETU (aditya)..." -ForegroundColor Yellow
git fetch aditya master

Write-Host ">>> Merging latest commits into current branch..." -ForegroundColor Yellow
git merge origin/master --no-edit

Write-Host ">>> Pushing to origin (Singh4Ashmeet)..." -ForegroundColor Green
git push origin master

Write-Host ">>> Pushing to aditya (Aditya Mittal)..." -ForegroundColor Green
$adityaPush = git push aditya master 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host ">>> Successfully pushed to adityamittal9012/YOJANA-SETU!" -ForegroundColor Green
} else {
    Write-Host ">>> Push to aditya failed due to GitHub access permissions." -ForegroundColor Magenta
    Write-Host ">>> To grant permission: Go to https://github.com/adityamittal9012/YOJANA-SETU/settings/access and invite 'Singh4Ashmeet' as a collaborator." -ForegroundColor Yellow
}

Write-Host ">>> Sync process finished!" -ForegroundColor Cyan
