/** A chef's answer shown under a review or a dish request. */
export default function ChefReply({ label, text }: { label: string; text: string }) {
  return (
    <div className="chef-reply">
      <p className="chef-reply-label">{label}</p>
      <p className="chef-reply-text">{text}</p>
    </div>
  )
}
