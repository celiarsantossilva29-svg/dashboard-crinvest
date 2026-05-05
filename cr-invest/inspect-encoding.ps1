$filePath = "c:\Users\giova\.gemini\antigravity\scratch\sistema-comissoes\cr-invest\src\app\dashboard\vendas\page.tsx"
$bytes = [System.IO.File]::ReadAllBytes($filePath)
$text = [System.Text.Encoding]::UTF8.GetString($bytes)

# Find the useState line with fTipoProduto
$idx = $text.IndexOf('fTipoProduto')
if ($idx -ge 0) {
    # Get context around it
    $start = [Math]::Max(0, $idx - 10)
    $len = [Math]::Min(120, $text.Length - $start)
    $snippet = $text.Substring($start, $len)
    Write-Host "Context: $snippet"
    Write-Host ""
    Write-Host "Hex codes around the type annotation:"
    # Find the < after useState
    $typeStart = $text.IndexOf('useState<', $idx)
    if ($typeStart -ge 0) {
        $typeSnippet = $text.Substring($typeStart, 60)
        Write-Host "Type snippet: $typeSnippet"
        Write-Host ""
        $chars = $typeSnippet.ToCharArray()
        for ($i = 0; $i -lt $chars.Length; $i++) {
            $hex = '{0:X4}' -f [int]$chars[$i]
            $ch = $chars[$i]
            if ([int]$ch -gt 127) {
                Write-Host "  Position $i : U+$hex  char='$ch'"
            }
        }
    }
}
