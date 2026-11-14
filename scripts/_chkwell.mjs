function isWellFormed(xml: string): boolean {
  let trimmed = xml.trim()
  if (!trimmed.startsWith("<")) return false
  trimmed = trimmed
    .replace(/<\?[\s\S]*?\?>/g, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<!\[CDATA\[[\s\S]*?\]\]>/g, "")
    .replace(/<![\s\S]*?>/g, "")
    .trim()
  console.log("stripped=", JSON.stringify(trimmed))
  if (!trimmed) return false
  const stack = []
  const re = /<([/!?]?)([A-Za-z_][\w:.-]*)((?:"[^"]*"|'[^']*'|[^>"'])*)(\/?)>/g
  let m
  while ((m = re.exec(trimmed)) !== null) {
    console.log("match", JSON.stringify(m[0]), "selfClose", JSON.stringify(m[4]))
    if (m[0].startsWith("<?")) continue
    if (m[0].startsWith("<!")) continue
    if (m[4]) continue
    if (m[1]) { const top = stack.pop(); if (top !== m[2]) return false }
    else stack.push(m[2])
  }
  console.log("stack", stack, "endswith>", trimmed.trimEnd().endsWith(">"))
  return stack.length === 0 && trimmed.trimEnd().endsWith(">")
}
console.log("RESULT", isWellFormed("<?xml version='1.0'?><Invoice/>"))