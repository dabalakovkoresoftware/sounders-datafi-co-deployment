write-host "Getting Environment Variables from AWS Secrets Manager..."

# Replace with your secret name
$secretName = "datafi-cdk-secrets"

# Get the secret value using AWS CLI and the 'sounders' profile
$secretString = aws secretsmanager get-secret-value `
    --secret-id $secretName `
    --profile sounders `
    --query SecretString `
    --output text

# Convert the JSON secret string into a PowerShell object
$secrets = $secretString | ConvertFrom-Json

# Iterate over each key and set it as an environment variable
foreach ($key in $secrets.PSObject.Properties.Name) {
    $value = $secrets.$key
    [System.Environment]::SetEnvironmentVariable($key, $value, "Process")
    Write-Host "Set environment variable: $key"
}

write-host "Deploying Sounders Datafi to AWS..."
npx cdk deploy --profile sounders
