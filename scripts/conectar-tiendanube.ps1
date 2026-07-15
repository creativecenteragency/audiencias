$ErrorActionPreference = "Stop"

function Read-Secret([string]$Prompt) {
  $secure = Read-Host $Prompt -AsSecureString
  $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  try { [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer) }
  finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer) }
}

try {
  Write-Host ""
  Write-Host "AUDIENCIAS V2 - CONECTAR TIENDANUBE" -ForegroundColor Cyan
  Write-Host "Las claves se guardan solamente en este equipo y no se muestran." -ForegroundColor DarkGray
  Write-Host ""

  $clientSecret = Read-Secret "Pega el Client Secret actual"
  $authorizationCode = Read-Secret "Pega solamente el code de autorizacion"

  $body = @{
    client_id = "36655"
    client_secret = $clientSecret
    grant_type = "authorization_code"
    code = $authorizationCode
  } | ConvertTo-Json

  $token = Invoke-RestMethod -Method Post -Uri "https://www.tiendanube.com/apps/authorize/token" -ContentType "application/json" -Body $body
  if (-not $token.access_token -or -not $token.user_id) { throw "Tiendanube no devolvio el token o el ID de tienda." }

  $envPath = Join-Path (Split-Path $PSScriptRoot -Parent) ".env.local"
  $content = @(
    "TIENDANUBE_APP_ID=36655"
    "TIENDANUBE_CLIENT_SECRET=$clientSecret"
    "TIENDANUBE_ACCESS_TOKEN=$($token.access_token)"
    "TIENDANUBE_STORE_ID=$($token.user_id)"
    ""
  ) -join "`r`n"
  [IO.File]::WriteAllText($envPath, $content, (New-Object Text.UTF8Encoding($false)))

  $headers = @{ Authorization = "Bearer $($token.access_token)"; "User-Agent" = "Audiencias Creative Center (36655)"; Accept = "application/json" }
  $base = "https://api.tiendanube.com/v1/$($token.user_id)"
  Write-Host ""
  Write-Host "Permisos detectados:" -ForegroundColor White
  foreach ($resource in @("orders", "customers", "products")) {
    $uri = "{0}/{1}?per_page=1&page=1" -f $base, $resource
    try {
      $response = Invoke-WebRequest -Uri $uri -Headers $headers -UseBasicParsing
      $total = $response.Headers["x-total-count"]
      if (-not $total) { $total = "sin conteo" }
      Write-Host ("  OK    {0,-10} {1} registros" -f $resource, $total) -ForegroundColor Green
    }
    catch {
      $status = if ($_.Exception.Response) { [int]$_.Exception.Response.StatusCode } else { 0 }
      Write-Host ("  ERROR {0,-10} HTTP {1}" -f $resource, $status) -ForegroundColor Red
    }
  }
  Write-Host ""
  Write-Host "Conexion guardada correctamente en .env.local." -ForegroundColor Green
  Write-Host "No copies el token ni el Client Secret a GitHub o al chat." -ForegroundColor Yellow
}
catch {
  Write-Host ""
  Write-Host "No se pudo completar la conexion:" -ForegroundColor Red
  Write-Host $_.Exception.Message -ForegroundColor Red
  Write-Host "Si el code vencio, desinstala y vuelve a instalar la app para obtener uno nuevo." -ForegroundColor Yellow
  exit 1
}