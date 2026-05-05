$filePath = "c:\Users\giova\.gemini\antigravity\scratch\sistema-comissoes\cr-invest\src\app\dashboard\vendas\page.tsx"
$bytes = [System.IO.File]::ReadAllBytes($filePath)
$text = [System.Text.Encoding]::UTF8.GetString($bytes)

# Build search strings from char codes directly
$search1 = [char]0x00C3, [char]0x00B3 -join ''  # Ã³ -> ó
$replace1 = [string][char]0x00F3

$search2 = [char]0x00C3, [char]0x00A7 -join ''  # Ã§ -> ç  
$replace2 = [string][char]0x00E7

$search3 = [char]0x00C3, [char]0x00A3 -join ''  # Ã£ -> ã
$replace3 = [string][char]0x00E3

$search4 = [char]0x00C3, [char]0x00AA -join ''  # Ãª -> ê
$replace4 = [string][char]0x00EA

$search5 = [char]0x00C3, [char]0x00A9 -join ''  # Ã© -> é
$replace5 = [string][char]0x00E9

Write-Host "Search1 length: $($search1.Length), hex: $('{0:X4}' -f [int]$search1[0]) $('{0:X4}' -f [int]$search1[1])"
Write-Host "Contains search1: $($text.Contains($search1))"

$count1 = ([regex]::Matches($text, [regex]::Escape($search1))).Count
Write-Host "Count of pattern 1: $count1"

$text = $text.Replace($search1, $replace1)
$text = $text.Replace($search2, $replace2)
$text = $text.Replace($search3, $replace3)
$text = $text.Replace($search4, $replace4)
$text = $text.Replace($search5, $replace5)

# Verify fix
$idx = $text.IndexOf('fTipoProduto')
$typeStart = $text.IndexOf('useState<', $idx)
$typeSnippet = $text.Substring($typeStart, 60)
Write-Host "After fix: $typeSnippet"

# Write back as UTF-8 without BOM
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($filePath, $text, $utf8NoBom)
Write-Host "File saved."
