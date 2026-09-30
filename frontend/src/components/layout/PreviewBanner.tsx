import './PreviewBanner.css'

/** True when the server marked this page as the preview site (backend/src/web/website.ts). */
function isPreviewSite(doc: Document = document): boolean {
  return doc.querySelector('meta[name="nk-preview"]')?.getAttribute('content') === 'true'
}

/** A slim note at the top of every page of the show-and-tell preview. */
export default function PreviewBanner() {
  if (!isPreviewSite()) return null
  return (
    <div className="preview-banner" role="note">
      <strong>Preview:</strong> practice orders only. No food is made and no one is charged.
    </div>
  )
}
