# Script to add all Firebase NEXT_PUBLIC env vars to Vercel
$env_vars = @{
    "NEXT_PUBLIC_FIREBASE_API_KEY" = "AIzaSyBSDicG4-L--x8LAABXu0BEzJ0x13SwIlQ"
    "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN" = "dbohranisbat.firebaseapp.com"
    "NEXT_PUBLIC_FIREBASE_PROJECT_ID" = "dbohranisbat"
    "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET" = "dbohranisbat.firebasestorage.app"
    "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID" = "769795414151"
    "NEXT_PUBLIC_FIREBASE_APP_ID" = "1:769795414151:web:8178c6db910e8f7cb94022"
    "FIREBASE_DETERMINISTIC_SALT" = "dbohrarishta_firebase_salt_change_me_in_production_2026"
    "OTP_SECRET" = "dbohrarishta_super_secret_otp_key_change_me_in_production_2026"
    "GMAIL_USER" = "53dbohrarishta@gmail.com"
    "GMAIL_APP_PASSWORD" = "bwgy poed mxpc keuj"
}

foreach ($key in $env_vars.Keys) {
    $value = $env_vars[$key]
    Write-Host "Adding $key..."
    # Pipe 'y' to auto-select all environments
    echo "$value`na`n" | npx vercel env add $key
    Start-Sleep -Seconds 1
}

Write-Host "All env vars added!"
