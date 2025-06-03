"use client"

import React, { useState, useRef, useEffect } from "react"
import { createPortal } from "react-dom"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Delete, Space, X } from "lucide-react"

interface OnScreenKeyboardProps {
  isVisible: boolean
  onKeyPress: (key: string) => void
  onClose: () => void
  targetType?: 'ip' | 'dns' | 'text' | 'number' | 'url'
}

interface KeyboardLayout {
  row1: string[]
  row2: string[]
  row3: string[]
  row4: string[]
  showLetters: boolean
}

export function OnScreenKeyboard({ 
  isVisible, 
  onKeyPress, 
  onClose, 
  targetType = 'text' 
}: OnScreenKeyboardProps) {
  const [capsLock, setCapsLock] = useState(false)
  const [shift, setShift] = useState(false)
  const [lastKeyPressTime, setLastKeyPressTime] = useState(0)
  const [isMounted, setIsMounted] = useState(false)
  const keyboardRef = useRef<HTMLDivElement>(null)

  // Debounce delay in milliseconds
  const DEBOUNCE_DELAY = 200

  // Ensure we only render on client side
  useEffect(() => {
    setIsMounted(true)
  }, [])

  // Define different keyboard layouts based on target type
  const getKeyboardLayout = (): KeyboardLayout => {
    switch (targetType) {
      case 'ip':
        return {
          row1: ['1', '2', '3'],
          row2: ['4', '5', '6'],
          row3: ['7', '8', '9'],
          row4: ['.', '0', '/'],
          showLetters: false
        }
      case 'dns':
        return {
          row1: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-'],
          row2: ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p', '.'],
          row3: ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', '_'],
          row4: ['z', 'x', 'c', 'v', 'b', 'n', 'm', ':', '/'],
          showLetters: true
        }
      case 'url':
        return {
          row1: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-', '='],
          row2: ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p', '.', '/'],
          row3: ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', ':', '_'],
          row4: ['z', 'x', 'c', 'v', 'b', 'n', 'm', '?', '&', '#'],
          showLetters: true
        }
      case 'number':
        return {
          row1: ['1', '2', '3'],
          row2: ['4', '5', '6'],
          row3: ['7', '8', '9'],
          row4: ['0', '.', '-'],
          showLetters: false
        }
      default:
        return {
          row1: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-', '='],
          row2: ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p', '[', ']'],
          row3: ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', ';', '\''],
          row4: ['z', 'x', 'c', 'v', 'b', 'n', 'm', ',', '.', '/', '_'],
          showLetters: true
        }
    }
  }

  const layout = getKeyboardLayout()

  const handleKeyPress = (key: string, event?: React.MouseEvent | React.TouchEvent) => {
    // Debouncing for touch events to prevent double inputs
    const now = Date.now()
    if (now - lastKeyPressTime < DEBOUNCE_DELAY) {
      return
    }
    setLastKeyPressTime(now)

    // Prevent focus loss when clicking keyboard keys
    if (event) {
      event.preventDefault()
      event.stopPropagation()
    }

    if (key === 'BACKSPACE') {
      onKeyPress('Backspace')
    } else if (key === 'SPACE') {
      onKeyPress(' ')
    } else if (key === 'CAPS') {
      setCapsLock(!capsLock)
      setShift(false) // Reset shift when caps lock is toggled
    } else if (key === 'SHIFT') {
      setShift(!shift)
    } else if (key === 'ENTER') {
      onKeyPress('Enter')
    } else {
      // Handle letter case
      let finalKey = key
      if (layout.showLetters && /^[a-zA-Z]$/.test(key)) {
        if (capsLock || shift) {
          finalKey = key.toUpperCase()
        } else {
          finalKey = key.toLowerCase()
        }
        // Reset shift after typing a character (like real keyboards)
        if (shift) {
          setShift(false)
        }
      }
      
      // Handle shift symbols for numbers and punctuation
      if (shift && !capsLock) {
        const shiftSymbols: { [key: string]: string } = {
          // Numbers to symbols
          '1': '!', '2': '@', '3': '#', '4': '$', '5': '%',
          '6': '^', '7': '&', '8': '*', '9': '(', '0': ')',
          // Punctuation to shifted punctuation
          '-': '_', '=': '+', '[': '{', ']': '}',
          ';': ':', '\'': '"', ',': '<', '.': '>', '/': '?'
        }
        if (shiftSymbols[key]) {
          finalKey = shiftSymbols[key]
          setShift(false) // Reset shift after using symbol
        }
      }
      
      onKeyPress(finalKey)
    }
  }

  // Prevent right-click context menu
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    return false
  }

  // Close keyboard when clicking outside, but not when clicking on keyboard
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (keyboardRef.current && !keyboardRef.current.contains(event.target as Node)) {
        // Check if the click is on an input element with keyboard enabled
        const target = event.target as Element
        if (!target.closest('input[data-keyboard-input], [data-keyboard-container]')) {
          onClose()
        }
      }
    }

    if (isVisible) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isVisible, onClose])

  if (!isVisible || !isMounted) return null

  const getKeyDisplay = (key: string) => {
    if (shift && !capsLock) {
      const shiftSymbols: { [key: string]: string } = {
        // Numbers to symbols
        '1': '!', '2': '@', '3': '#', '4': '$', '5': '%',
        '6': '^', '7': '&', '8': '*', '9': '(', '0': ')',
        // Punctuation to shifted punctuation
        '-': '_', '=': '+', '[': '{', ']': '}',
        ';': ':', '\'': '"', ',': '<', '.': '>', '/': '?'
      }
      if (shiftSymbols[key]) {
        return shiftSymbols[key]
      }
    }
    
    if (layout.showLetters && /^[a-zA-Z]$/.test(key)) {
      return (capsLock || shift) ? key.toUpperCase() : key.toLowerCase()
    }
    
    return key
  }

  const keyboardElement = (
    <div 
      className="fixed inset-0 z-[99999] pointer-events-none"
      style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}
    >
      <div className="absolute bottom-0 left-0 right-0 flex justify-center p-4 pointer-events-none">
        <Card 
          ref={keyboardRef} 
          className="w-full max-w-4xl bg-white shadow-2xl pointer-events-auto relative"
          onMouseDown={(e) => e.preventDefault()} // Prevent focus loss
          onContextMenu={handleContextMenu} // Disable right-click
          style={{ userSelect: 'none' }} // Prevent text selection
        >
          {/* Close button */}
          <Button
            variant="ghost"
            size="sm"
            className="absolute top-2 right-2 h-8 w-8 p-0 hover:bg-gray-100 z-10"
            onClick={onClose}
            onMouseDown={(e) => e.stopPropagation()}
            onContextMenu={handleContextMenu}
          >
            <X className="w-4 h-4" />
          </Button>

          <CardContent className="p-4">
            <div className="space-y-2">
              
              {/* Render different layouts based on type */}
              {!layout.showLetters ? (
                // Numeric keypad layout - Clean 4x3 grid
                <div className="flex flex-col items-center space-y-2">
                  {/* Row 1: 1 2 3 */}
                  <div className="flex gap-2">
                    {layout.row1.map((key) => (
                      <Button
                        key={key}
                        variant="outline"
                        className="h-14 w-14 p-0 text-lg font-medium select-none"
                        onMouseDown={(e) => handleKeyPress(key, e)}
                        onTouchStart={(e) => {
                          e.preventDefault()
                          handleKeyPress(key, e)
                        }}
                        onContextMenu={handleContextMenu}
                      >
                        {getKeyDisplay(key)}
                      </Button>
                    ))}
                  </div>

                  {/* Row 2: 4 5 6 */}
                  <div className="flex gap-2">
                    {layout.row2.map((key) => (
                      <Button
                        key={key}
                        variant="outline"
                        className="h-14 w-14 p-0 text-lg font-medium select-none"
                        onMouseDown={(e) => handleKeyPress(key, e)}
                        onTouchStart={(e) => {
                          e.preventDefault()
                          handleKeyPress(key, e)
                        }}
                        onContextMenu={handleContextMenu}
                      >
                        {getKeyDisplay(key)}
                      </Button>
                    ))}
                  </div>

                  {/* Row 3: 7 8 9 */}
                  <div className="flex gap-2">
                    {layout.row3.map((key) => (
                      <Button
                        key={key}
                        variant="outline"
                        className="h-14 w-14 p-0 text-lg font-medium select-none"
                        onMouseDown={(e) => handleKeyPress(key, e)}
                        onTouchStart={(e) => {
                          e.preventDefault()
                          handleKeyPress(key, e)
                        }}
                        onContextMenu={handleContextMenu}
                      >
                        {getKeyDisplay(key)}
                      </Button>
                    ))}
                  </div>

                  {/* Row 4: Variable number of keys + Delete */}
                  <div className="flex gap-2 justify-center">
                    {layout.row4.map((key) => (
                      <Button
                        key={key}
                        variant="outline"
                        className="h-14 w-14 p-0 text-lg font-medium select-none"
                        onMouseDown={(e) => handleKeyPress(key, e)}
                        onTouchStart={(e) => {
                          e.preventDefault()
                          handleKeyPress(key, e)
                        }}
                        onContextMenu={handleContextMenu}
                      >
                        {getKeyDisplay(key)}
                      </Button>
                    ))}
                  
                    <Button
                      variant="outline"
                      className="h-14 w-14 p-0 text-sm select-none"
                      onMouseDown={(e) => handleKeyPress('BACKSPACE', e)}
                      onTouchStart={(e) => {
                        e.preventDefault()
                        handleKeyPress('BACKSPACE', e)
                      }}
                      onContextMenu={handleContextMenu}
                    >
                      <Delete className="w-5 h-5" />
                    </Button>
                  </div>
                </div>
              ) : (
                // Full QWERTY layout
                <>
                  {/* Numbers row */}
                  <div className="flex gap-1 justify-center flex-wrap">
                    {layout.row1.map((key) => (
                      <Button
                        key={key}
                        variant="outline"
                        className="h-12 w-12 p-0 text-sm font-medium select-none"
                        onMouseDown={(e) => handleKeyPress(key, e)}
                        onTouchStart={(e) => {
                          e.preventDefault()
                          handleKeyPress(key, e)
                        }}
                        onContextMenu={handleContextMenu}
                      >
                        {getKeyDisplay(key)}
                      </Button>
                    ))}
                    <Button
                      variant="outline"
                      className="h-12 w-20 p-0 text-sm select-none"
                      onMouseDown={(e) => handleKeyPress('BACKSPACE', e)}
                      onTouchStart={(e) => {
                        e.preventDefault()
                        handleKeyPress('BACKSPACE', e)
                      }}
                      onContextMenu={handleContextMenu}
                    >
                      <Delete className="w-4 h-4" />
                    </Button>
                  </div>

                  {/* Second row */}
                  <div className="flex gap-1 justify-center flex-wrap">
                    {layout.row2.map((key) => (
                      <Button
                        key={key}
                        variant="outline"
                        className="h-12 w-12 p-0 text-sm font-medium select-none"
                        onMouseDown={(e) => handleKeyPress(key, e)}
                        onTouchStart={(e) => {
                          e.preventDefault()
                          handleKeyPress(key, e)
                        }}
                        onContextMenu={handleContextMenu}
                      >
                        {getKeyDisplay(key)}
                      </Button>
                    ))}
                  </div>

                  {/* Third row */}
                  <div className="flex gap-1 justify-center flex-wrap">
                    {layout.showLetters && (
                      <Button
                        variant={capsLock ? "default" : "outline"}
                        className="h-12 w-16 p-0 text-xs font-medium select-none"
                        onMouseDown={(e) => handleKeyPress('CAPS', e)}
                        onTouchStart={(e) => {
                          e.preventDefault()
                          handleKeyPress('CAPS', e)
                        }}
                        onContextMenu={handleContextMenu}
                      >
                        CAPS
                      </Button>
                    )}
                    {layout.row3.map((key) => (
                      <Button
                        key={key}
                        variant="outline"
                        className="h-12 w-12 p-0 text-sm font-medium select-none"
                        onMouseDown={(e) => handleKeyPress(key, e)}
                        onTouchStart={(e) => {
                          e.preventDefault()
                          handleKeyPress(key, e)
                        }}
                        onContextMenu={handleContextMenu}
                      >
                        {getKeyDisplay(key)}
                      </Button>
                    ))}
                  </div>

                  {/* Fourth row */}
                  <div className="flex gap-1 justify-center flex-wrap">
                    {layout.showLetters && (
                      <Button
                        variant={shift ? "default" : "outline"}
                        className="h-12 w-16 p-0 text-xs font-medium select-none"
                        onMouseDown={(e) => handleKeyPress('SHIFT', e)}
                        onTouchStart={(e) => {
                          e.preventDefault()
                          handleKeyPress('SHIFT', e)
                        }}
                        onContextMenu={handleContextMenu}
                      >
                        SHIFT
                      </Button>
                    )}
                    {layout.row4.map((key) => (
                      <Button
                        key={key}
                        variant="outline"
                        className="h-12 w-12 p-0 text-sm font-medium select-none"
                        onMouseDown={(e) => handleKeyPress(key, e)}
                        onTouchStart={(e) => {
                          e.preventDefault()
                          handleKeyPress(key, e)
                        }}
                        onContextMenu={handleContextMenu}
                      >
                        {getKeyDisplay(key)}
                      </Button>
                    ))}
                  </div>

                  {/* Space bar row */}
                  <div className="flex gap-1 justify-center">
                    <Button
                      variant="outline"
                      className="h-12 w-48 p-0 text-sm font-medium select-none"
                      onMouseDown={(e) => handleKeyPress('SPACE', e)}
                      onTouchStart={(e) => {
                        e.preventDefault()
                        handleKeyPress('SPACE', e)
                      }}
                      onContextMenu={handleContextMenu}
                    >
                      <Space className="w-4 h-4 mr-2" />
                      Space
                    </Button>
                    <Button
                      variant="outline"
                      className="h-12 w-20 p-0 text-sm font-medium select-none"
                      onMouseDown={(e) => handleKeyPress('ENTER', e)}
                      onTouchStart={(e) => {
                        e.preventDefault()
                        handleKeyPress('ENTER', e)
                      }}
                      onContextMenu={handleContextMenu}
                    >
                      Enter
                    </Button>
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )

  // Use portal to render outside of any dialog container
  return createPortal(keyboardElement, document.body)
} 