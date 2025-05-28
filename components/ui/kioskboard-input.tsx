import React, { useRef, useEffect } from 'react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

// Declare KioskBoard on window
declare global {
  interface Window {
    KioskBoard: any;
  }
}

interface KioskBoardInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  className?: string;
}

const KioskBoardInput = React.forwardRef<HTMLInputElement, KioskBoardInputProps>(
  ({ className, onFocus, onBlur, ...props }, ref) => {
    const inputRef = useRef<HTMLInputElement>(null)
    const keyboardInitialized = useRef(false)

    // Load KioskBoard library
    useEffect(() => {
      if (typeof window !== 'undefined' && !window.KioskBoard) {
        // Create script tag to load KioskBoard
        const script = document.createElement('script')
        script.src = 'https://cdn.jsdelivr.net/npm/kioskboard@2.3.0/dist/kioskboard-aio-2.3.0.min.js'
        script.async = true
        
        // Create link tag for CSS
        const link = document.createElement('link')
        link.rel = 'stylesheet'
        link.href = 'https://cdn.jsdelivr.net/npm/kioskboard@2.3.0/dist/kioskboard-2.3.0.min.css'
        
        // Add to head
        document.head.appendChild(link)
        document.head.appendChild(script)
      }
    }, [])

    // Initialize keyboard for this specific input
    const initializeKeyboard = () => {
      if (typeof window !== 'undefined' && window.KioskBoard && inputRef.current && !keyboardInitialized.current) {
        try {
          const defaultKeysArray = [
            {
              "0": "Q", "1": "W", "2": "E", "3": "R", "4": "T", 
              "5": "Y", "6": "U", "7": "I", "8": "O", "9": "P"
            },
            {
              "0": "A", "1": "S", "2": "D", "3": "F", "4": "G", 
              "5": "H", "6": "J", "7": "K", "8": "L"
            },
            {
              "0": "Z", "1": "X", "2": "C", "3": "V", "4": "B", 
              "5": "N", "6": "M"
            },
            {
              "0": "1", "1": "2", "2": "3", "3": "4", "4": "5", 
              "5": "6", "6": "7", "7": "8", "8": "9", "9": "0"
            },
            {
              "0": ".", "1": "-", "2": "/", "3": ":", "4": " "
            }
          ]

          window.KioskBoard.run(inputRef.current, {
            language: 'en',
            theme: 'light',
            allowRealKeyboard: true,
            allowMobileKeyboard: false,
            autoScroll: true,
            cssAnimations: true,
            cssAnimationsDuration: 360,
            cssAnimationsStyle: 'slide',
            keysAllowSpacebar: true,
            keysSpacebarText: 'Space',
            keysFontFamily: 'sans-serif',
            keysFontSize: '18px',
            keysFontWeight: 'normal',
            keysIconSize: '20px',
            keysArrayOfObjects: defaultKeysArray
          })
          
          keyboardInitialized.current = true
        } catch (error) {
          console.error('Error initializing KioskBoard:', error)
        }
      }
    }

    const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
      // Try to initialize keyboard when focused
      if (window.KioskBoard) {
        initializeKeyboard()
      } else {
        // If KioskBoard not loaded yet, wait a bit and try again
        setTimeout(initializeKeyboard, 100)
      }
      
      // Call original onFocus if provided
      if (onFocus) {
        onFocus(e)
      }
    }

    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
      // Call original onBlur if provided
      if (onBlur) {
        onBlur(e)
      }
    }

    return (
      <Input
        ref={(node) => {
          inputRef.current = node
          if (typeof ref === 'function') {
            ref(node)
          } else if (ref) {
            ref.current = node
          }
        }}
        className={cn(className)}
        onFocus={handleFocus}
        onBlur={handleBlur}
        {...props}
      />
    )
  }
)

KioskBoardInput.displayName = "KioskBoardInput"

export { KioskBoardInput } 