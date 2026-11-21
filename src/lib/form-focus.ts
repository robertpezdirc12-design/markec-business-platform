// focusFirstFormError — po neuspešni validaciji obrazca premakne fokus in
// skot na prvo napako (NN/g "error recovery" H9/H5, WCAG 3.3.1 / 3.3.3).
// Skupna pripomocek med booking, reviews in vsemi drugimi obrazci.

export function focusFirstFormError() {
  // nežen requestAnimationFrame, da se aria-invalid slike z errorjem odrenderajo
  requestAnimationFrame(() => {
    const first = document.querySelector<HTMLElement>(
      '[aria-invalid="true"], [data-error="true"]'
    )
    if (first) {
      first.focus({ preventScroll: false })
      first.scrollIntoView({ block: "center", behavior: "smooth" })
    }
  })
}