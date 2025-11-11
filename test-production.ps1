# PowerShell script to test production SEO
# Usage: .\test-production.ps1

$env:TEST_URL = "https://www.pokemonpalette.com"
npm run test:seo

