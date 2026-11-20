// template (в отличие от layout) монтируется заново при каждом переходе — так блоки страницы плавно входят.
// Смена ?d= или ?view= внутри одной страницы анимацию не перезапускает.
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="page-enter">{children}</div>;
}
