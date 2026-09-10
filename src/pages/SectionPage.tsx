type SectionPageProps = { title: string }

export function SectionPage({ title }: SectionPageProps) {
  return (
    <section className="page page--section">
      <div className="page__content">
        <p className="eyebrow">MicronHub</p>
        <h1>{title}</h1>
      </div>
    </section>
  )
}
