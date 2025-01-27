import { TypewrittenTextMirror } from './typewritten-text-mirror.js'
import {
    nextCharEvent,
    prevCharEvent,
    phraseTypedEvent,
    phraseRemovedEvent,
    startedEvent,
    pausedEvent
} from './events.js'
import { template } from './template.js'

const FORWARD = 'forward'
const BACKWARD = 'backward'

export class TypewrittenText extends HTMLElement {
    static elementName = 'typewritten-text'
    static defaultLetterInterval = 100
    static defaultPhraseInterval = 1000
    static defaultInitDelayInterval = 500
    static defaultStopTick = false

    static get observedAttributes() {
        return ['paused']
    }

    constructor() {
        super()

        this
            .attachShadow({ mode: 'open' })
            .appendChild(template.content.cloneNode(true))
        
        this.currentPosition = 0
        this.mirror = null
        this.direction = FORWARD
    }

    connectedCallback() {
        if (!this.mirror) this.createMirror()

        this.insertMirror()
        this.tick()

        this.shadowRoot.querySelector('slot').addEventListener('slotchange', this.reset)
    }

    attributeChangedCallback(name, oldValue, newValue) {
        if (name === 'paused') {
            if (newValue === null || newValue === undefined) {
                this.dispatchEvent(startedEvent())
                this.tick()
            } else {
                this.dispatchEvent(pausedEvent())
            }
        }
    }

    get letterInterval() {
        return parseInt(this.getAttribute('letter-interval')) || TypewrittenText.defaultLetterInterval
    }
    set letterInterval(value) {
        if (value === null) {
            this.removeAttribute('letter-interval')
        } else {
            this.setAttribute('letter-interval', value.toString())
        }
    }

    get phraseInterval() {
        return parseInt(this.getAttribute('phrase-interval')) || TypewrittenText.defaultPhraseInterval
    }
    set phraseInterval(value) {
        if (value === null) {
            this.removeAttribute('phrase-interval')
        } else {
            this.setAttribute('phrase-interval', value.toString())
        }
    }
    
    get initDelayInterval() {
        return (
          parseInt(this.getAttribute("init-delay-interval")) ||
          TypewrittenText.defaultInitDelayInterval
        )
    }
    set initDelayInterval(value) {
        if (value === null) {
          this.removeAttribute("init-delay-interval");
        } else {
          this.setAttribute("init-delay-interval", value.toString());
        }
    }

    get stopTick() {
        let isStopTick = this.getAttribute("stop-tick") == "true" || false;
        return isStopTick || TypewrittenText.defaultStopTick;
    }
    set stopTick(value) {
        if (value === null) {
          this.removeAttribute("stop-tick");
        } else {
          this.setAttribute("stop-tick", value.toString());
        }
    }

    get paused() { return this.hasAttribute('paused') }
    set paused(value) {
        if (value) {
            this.setAttribute('paused', '')
        } else {
            this.removeAttribute('paused')
        }
    }

    get repeat() { return this.hasAttribute('repeat') }
    set repeat(value) {
        if (value) {
            this.setAttribute('repeat', '')
        } else {
            this.removeAttribute('repeat')
        }
    }

    get length() {
        return this.mirror.querySelectorAll('.typewritten-text_character').length
    }

    typeNext = () => {
        if (this.currentPosition < this.length) {
            this.dispatchEvent(nextCharEvent(this.currentPosition))
            this.currentPosition += 1

            if (this.currentPosition === this.length)
                this.dispatchEvent(phraseTypedEvent())
        }
    }

    backspace = () => {
        if (this.currentPosition > 0) {
            this.currentPosition -= 1
            this.dispatchEvent(prevCharEvent(this.currentPosition))

            if (this.currentPosition === 0)
                this.dispatchEvent(phraseRemovedEvent())
        }
    }

    start = () => this.paused = false
    pause = () => this.paused = true

    tick = () => {
        if (this.paused)
            return

        const reversed = this.forceTick()

        if (!reversed || this.repeat) {
            setTimeout(function () {
                setTimeout(this.tick, reversed ? this.phraseInterval : this.letterInterval)
            }, this.initDelayInterval)
            this.initDelayInterval = 1
        } else {
            if (this.stopTick) {
                let tickerElement = this.querySelectorAll(".typewritten-text_character.typewritten-text_current.typewritten-text_revealed").length > 0  ? this.querySelectorAll(".typewritten-text_character.typewritten-text_current.typewritten-text_revealed") : null;
                if (tickerElement != null) tickerElement[0].classList.remove("typewritten-text_current");
            }
            this.pause()
        }
    }

    reverse = () => {
        this.direction = this.direction === FORWARD ? BACKWARD : FORWARD
    }

    reset = () => {
        this.currentPosition = 0
        this.mirror.remove()
        this.createMirror()
        this.insertMirror()
    }

    forceTick = () => {
        if (this.direction === FORWARD) {
            this.typeNext()
        } else {
            this.backspace()
        }

        const reversed = this.currentPosition <= 0 || this.currentPosition >= this.length

        if (reversed) this.reverse()
        return reversed
    }

    divideIntoCharacters = (node = this) => {
        const isAlphanumeric = ch => /[a-zA-Z0-9_]/.test(ch)
        return [...node.childNodes].map(n => {
            if (n.nodeType === Node.TEXT_NODE) {
                const characters = [...n.textContent]
                let wordStarted = false
                const result = characters.reduce((acc, ch) => {
                    let wordSpan = ''

                    if (!wordStarted && isAlphanumeric(ch)) {
                        wordStarted = true
                        wordSpan = '<span class="typewritten-text_word">'
                    } else if (wordStarted && !isAlphanumeric(ch)) {
                        wordStarted = false
                        wordSpan = '</span>'
                    }

                    return `${acc}${wordSpan}<span aria-hidden="true" class="typewritten-text_character">${ch}</span>`
                }, '')

                if (wordStarted) {
                    return `${result}</span>`
                } else {
                    return result
                }
            } else {
                const nn = n.cloneNode(false)
                nn.innerHTML = this.divideIntoCharacters(n)
                return nn.outerHTML
            }
        }).join('')
    }

    createMirror = () => {
        this.mirror = new TypewrittenTextMirror(this)
        this.mirror.slot = 'mirror'
        this.mirror.innerHTML = `<span class="typewritten-text_start typewritten-text_current"></span>` + this.divideIntoCharacters()
    }

    insertMirror = () => {
        this.appendChild(this.mirror)
    }
}
