/** Shared, server-renderable title motion; the full label remains readable to AT. */
export default function TitleReveal({ text }: { text: string }) {
  let position = 0
  return <span className="title-reveal" aria-label={text}>{text.split(/(\s+)/).map((word, index) => /\s/.test(word) ? <span key={index}> </span> : <span className="title-word" aria-hidden="true" key={index}>{Array.from(word).map((letter,i)=><span className="title-letter" style={{animationDelay:`${Math.min(position++,22)*40}ms`}} key={i}>{letter}</span>)}</span>)}</span>
}
