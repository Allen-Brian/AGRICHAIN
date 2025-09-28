# ------------------------------
# CONFIG
# ------------------------------
$baseUrl = "http://172.20.10.12:3000"
$apiKey = "supersecret123"   # replace with your API key
$farmerId = "1ee22edb-dd5f-4e8d-b61e-8ac9cc612010"  # replace with an actual farmer ID
$transporterId = "ef6444b1-3bfb-4a17-9379-e82965fe6f4c" # replace with an actual transporter ID

# ------------------------------
# 1. Health check
# ------------------------------
Write-Host "`n=== Health Check ==="
Invoke-RestMethod -Method GET -Uri "$baseUrl/health"

# ------------------------------
# 2. Create Hedera Topic
# ------------------------------
Write-Host "`n=== Create Hedera Topic ==="
$topicResponse = Invoke-RestMethod -Method POST -Uri "$baseUrl/api/hedera/create-topic" `
  -Headers @{ "x-api-key" = $apiKey } `
  -Body (ConvertTo-Json @{ memo = "Farmer Harvest Logs" }) `
  -ContentType "application/json"

$topicId = $topicResponse.topicId
Write-Host "Created Topic ID: $topicId"

# ------------------------------
# 3. Submit Harvest
# ------------------------------
Write-Host "`n=== Submit Harvest ==="
$harvestBody = @{
    data = @{
        farmer_id = $farmerId
        crop_type = "Maize"
        estimated_weight_kg = 120
        photo_url = "https://example.com/photo.jpg"
        gps_lat = 5.123456
        gps_long = 10.654321
        photo_urls = @("https://example.com/photo1.jpg","https://example.com/photo2.jpg")
    }
    topicId = $topicId
}

$harvestResponse = Invoke-RestMethod -Method POST -Uri "$baseUrl/api/hedera/submit-harvest" `
  -Headers @{ "x-api-key" = $apiKey } `
  -Body (ConvertTo-Json $harvestBody -Compress) `
  -ContentType "application/json"

$harvestId = $harvestResponse.harvestId
Write-Host "Harvest submitted. ID: $harvestId"

# ------------------------------
# 4. Start Transport Job
# ------------------------------
Write-Host "`n=== Start Transport Job ==="
$scheduledPickup = (Get-Date).ToUniversalTime().AddMinutes(10).ToString("yyyy-MM-ddTHH:mm:ssZ")
$scheduledDelivery = (Get-Date).ToUniversalTime().AddHours(2).ToString("yyyy-MM-ddTHH:mm:ssZ")

$transportStartBody = @{
    harvestId = $harvestId
    transporter_id = $transporterId
    pickup_location = "Farm A"
    delivery_location = "Market B"
    scheduled_pickup_time = $scheduledPickup
    scheduled_delivery_time = $scheduledDelivery
}

$transportStartResponse = Invoke-RestMethod -Method POST -Uri "$baseUrl/api/transport/start" `
  -Headers @{ "x-api-key" = $apiKey } `
  -Body (ConvertTo-Json $transportStartBody -Compress) `
  -ContentType "application/json"

$transportJobId = $transportStartResponse.transportJobId
Write-Host "Transport Job started. ID: $transportJobId"

# ------------------------------
# 5. Complete Transport Job
# ------------------------------
Write-Host "`n=== Complete Transport Job ==="
$actualDeliveryTime = (Get-Date).ToUniversalTime().AddHours(2).AddMinutes(5).ToString("yyyy-MM-ddTHH:mm:ssZ")

$transportCompleteBody = @{
    transportJobId = $transportJobId
    actual_delivery_time = $actualDeliveryTime
}

$transportCompleteResponse = Invoke-RestMethod -Method POST -Uri "$baseUrl/api/transport/complete" `
  -Headers @{ "x-api-key" = $apiKey } `
  -Body (ConvertTo-Json $transportCompleteBody -Compress) `
  -ContentType "application/json"

Write-Host "Transport Job completed. ID: $transportJobId"
Write-Host "All steps executed successfully."
