// Developer-mode gate. In the browser console:
//     devMode = True          → asks for a password (the console can't read input, so you answer with devAuth)
//     devAuth("the password") → unlocks the developer tools
//     devMode = False         → locks them again and resets every tuned value
//
// NOTE: this is a deterrent, not real security. Everything the browser downloads can be read by whoever opens it, so anyone
// determined can bypass a check like this. It keeps casual visitors out and the password isn't stored in plain text (only a
// salted SHA-256 hash), but don't put anything in the dev tools that would be harmful if a stranger got hold of it. For real
// protection, don't ship the dev tools in the production build at all.
import { setState } from '../game/store'
import { resetAll, resetCheats } from './devState'

const SALT = 'ddm-dev-v1:'
const HASH = '7a1973ec7c15283df4fc391a689d0e70ffc854a8b510c5239be7f7aa8d78fb35' // sha256(SALT + password)
const MAX_TRIES = 5

let armed = false // devMode = True was typed; waiting for the password
let unlocked = false
let tries = 0
let lockedOut = false

const log = (msg, color = '#7be3ff') => console.log(`%c${msg}`, `color:${color};font-weight:bold;font-family:monospace`)

async function verify(password) {
  if (!globalThis.crypto?.subtle) throw new Error('password check needs https:// or localhost')
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(SALT + password))
  const hex = Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('')
  return hex === HASH
}

function lock() {
  unlocked = false
  armed = false
  resetCheats()
  resetAll()
  setState({ devUnlocked: false, devColliders: false })
  log('Developer mode off. All tuned values were reset.', '#ffb347')
}

function devAuth(password) {
  if (unlocked) return log('Developer mode is already on.')
  if (!armed) return log('Type  devMode = True  first.', '#ffb347')
  if (lockedOut) return log('Too many wrong attempts. Reload the page to try again.', '#ff6b6b')
  if (typeof password !== 'string') return log('Usage:  devAuth("your password")', '#ffb347')
  verify(password)
    .then((ok) => {
      if (ok) {
        unlocked = true
        armed = false
        tries = 0
        setState({ devUnlocked: true })
        log('Developer mode on.  Press \\ (backslash) to hide or show the panel.', '#7dff9b')
        return
      }
      tries++
      if (tries >= MAX_TRIES) {
        lockedOut = true
        armed = false
        log('✖ Wrong password. Too many attempts, reload the page to try again.', '#ff6b6b')
      } else {
        setTimeout(() => log(`✖ Wrong password (${MAX_TRIES - tries} attempts left).`, '#ff6b6b'), 600) // small delay slows guessing
      }
    })
    .catch((e) => log(`Couldn't check the password: ${e.message}`, '#ff6b6b'))
}

if (typeof window !== 'undefined') {
  // `devMode = True` is Python-style; JavaScript only knows `true`. Define True/False so the Python spelling works too.
  for (const [name, value] of [['True', true], ['False', false]]) {
    if (!(name in window)) Object.defineProperty(window, name, { value, configurable: true })
  }
  Object.defineProperty(window, 'devAuth', { value: devAuth, configurable: false, writable: false })
  Object.defineProperty(window, 'devMode', {
    configurable: false,
    get: () => unlocked,
    set(value) {
      if (!value) return unlocked || armed ? lock() : undefined
      if (unlocked) return log('Developer mode is already on.')
      if (lockedOut) return log('Too many wrong attempts. Reload the page to try again.', '#ff6b6b')
      armed = true
      log('Developer mode needs a password.', '#ffd23f')
      log('Type your password like this:   devAuth("password")', '#ffd23f')
    },
  })
}
