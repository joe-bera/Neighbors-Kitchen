const NEW_TAB = '<base target="_blank">'

/** Makes the links inside an email preview open in a new tab instead of inside the preview frame. */
export function withLinksInNewTab(html: string): string {
  return /<head[^>]*>/i.test(html) ? html.replace(/<head([^>]*)>/i, `<head$1>${NEW_TAB}`) : `${NEW_TAB}${html}`
}
