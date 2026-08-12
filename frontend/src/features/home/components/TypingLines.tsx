import { useEffect, useState } from "react";
import "../styles/TypingLines.css";

const lines = [
    "Build your skills.",
    "Share your work.",
    "Compete in the arena.",
    "Keep shipping.",
    "Build with purpose.",
    "Code. Learn. Grow.",
]

function TypingLines() {
    const [lineIndex, setLineIndex] = useState(0) //stores which line is currently being typed
    const [charIndex, setCharIndex] = useState(0) //stores how many characters of the current line are visible

    //stores whether the component is currently deleting text (for the backspacing effect)
    //false = typing forward, true = deleting text
    const [isDeleting, setIsDeleting] = useState(false)
    useEffect(() => {
        const currentLine = lines[lineIndex]

        //typing forward and line is not deleting
        if (!isDeleting && charIndex < currentLine.length) {
            const timeout = window.setTimeout(() => {
                setCharIndex((currentIndex) => currentIndex + 1)
            }, 70) //timer for typing each character. Adjust this value to speed up or slow down the typing effect.

            return () => window.clearTimeout(timeout)
        }

        if (!isDeleting && charIndex === currentLine.length) {
            const timeout = window.setTimeout(() => {
                setIsDeleting(true)
            }, 900) //timer for how long to wait before deleting text. Adjust this value to change the delay.

            return () => window.clearTimeout(timeout)
        }

        if (isDeleting && charIndex > 0) {
            const timeout = window.setTimeout(() => {
                setCharIndex((currentIndex) => currentIndex - 1)
            }, 35) //timer for deleting each character. Adjust this value to speed up or slow down the backspacing effect.

            return () => window.clearTimeout(timeout)
        }

        const timeout = window.setTimeout(() => {
            setIsDeleting(false)
            setLineIndex((currentIndex) => (currentIndex + 1) % lines.length)
        }, 250)

        return () => window.clearTimeout(timeout)
    }, [lineIndex, charIndex, isDeleting])

    return (
        <span className="typing-line">
            {lines[lineIndex].slice(0, charIndex)}
        </span>
    )
}

export default TypingLines
