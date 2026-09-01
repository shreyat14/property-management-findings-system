import { navigate } from './navigation.js'

export function Link({ to, children, onClick, ...props }) {
  function handleClick(event) {
    onClick?.(event)

    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return
    }

    event.preventDefault()
    navigate(to)
  }

  return <a href={to} onClick={handleClick} {...props}>{children}</a>
}
