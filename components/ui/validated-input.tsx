"use client"

import React, { useState, useRef, useEffect } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { OnScreenKeyboard } from "@/components/ui/on-screen-keyboard"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Keyboard, AlertCircle } from "lucide-react"

interface ValidatedInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  value: string
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  validationType?: 'ip' | 'dns' | 'text' | 'number' | 'url'
  enableKeyboard?: boolean
  showKeyboardButton?: boolean
}

// Validation functions
const validateInput = (value: string, type: string): { isValid: boolean; error?: string } => {
  // Check for comma in IP and DNS inputs
  if ((type === 'ip' || type === 'dns') && value.includes(',')) {
    return {
      isValid: false,
      error: 'Commas are not allowed in IP addresses and DNS entries. Use separate fields for multiple values.'
    }
  }

  // IP address validation
  if (type === 'ip' && value) {
    const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/
    if (!ipRegex.test(value)) {
      return {
        isValid: false,
        error: 'Please enter a valid IP address (e.g., 192.168.1.1)'
      }
    }
  }

  // DNS validation (similar to IP but can also be domain names)
  if (type === 'dns' && value) {
    const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/
    const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/
    
    if (!ipRegex.test(value) && !domainRegex.test(value)) {
      return {
        isValid: false,
        error: 'Please enter a valid IP address or domain name (e.g., 8.8.8.8 or dns.google.com)'
      }
    }
  }

  // URL validation
  if (type === 'url' && value) {
    try {
      // Try to create a URL object to validate
      const url = new URL(value)
      // Basic checks for valid protocols
      if (!['http:', 'https:', 'ftp:'].includes(url.protocol)) {
        return {
          isValid: false,
          error: 'Please enter a valid URL starting with http://, https://, or ftp://'
        }
      }
    } catch {
      // If URL constructor fails, try simple regex for basic validation
      const urlRegex = /^(https?|ftp):\/\/[^\s/$.?#].[^\s]*$/i
      if (!urlRegex.test(value)) {
        return {
          isValid: false,
          error: 'Please enter a valid URL (e.g., https://www.google.com)'
        }
      }
    }
  }

  return { isValid: true }
}

export function ValidatedInput({
  value,
  onChange,
  validationType = 'text',
  enableKeyboard = true,
  showKeyboardButton = true,
  className,
  onFocus,
  onBlur,
  ...props
}: ValidatedInputProps) {
  const [showKeyboard, setShowKeyboard] = useState(false)
  const [validation, setValidation] = useState<{ isValid: boolean; error?: string }>({ isValid: true })
  const [isFocused, setIsFocused] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Validate input on value change
  useEffect(() => {
    if (value) {
      const result = validateInput(value, validationType)
      setValidation(result)
    } else {
      setValidation({ isValid: true })
    }
  }, [value, validationType])

  // Handle input change with comma prevention
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value

    // Prevent comma input for IP and DNS fields
    if ((validationType === 'ip' || validationType === 'dns') && newValue.includes(',')) {
      // Show validation error briefly
      setValidation({
        isValid: false,
        error: 'Commas are not allowed. Use separate fields for multiple values.'
      })
      
      // Clear error after 3 seconds
      setTimeout(() => {
        if (inputRef.current && !inputRef.current.value.includes(',')) {
          setValidation({ isValid: true })
        }
      }, 3000)
      
      return // Don't update the value
    }

    onChange(e)
  }

  // Handle on-screen keyboard input
  const handleKeyboardInput = (key: string) => {
    if (!inputRef.current) return

    const input = inputRef.current
    const start = input.selectionStart || 0
    const end = input.selectionEnd || 0
    const currentValue = input.value

    if (key === 'Backspace') {
      if (start === end && start > 0) {
        // Delete single character
        const newValue = currentValue.slice(0, start - 1) + currentValue.slice(start)
        const syntheticEvent = {
          target: { value: newValue }
        } as React.ChangeEvent<HTMLInputElement>
        onChange(syntheticEvent)
        
        // Set cursor position
        setTimeout(() => {
          input.setSelectionRange(start - 1, start - 1)
        }, 0)
      } else if (start !== end) {
        // Delete selection
        const newValue = currentValue.slice(0, start) + currentValue.slice(end)
        const syntheticEvent = {
          target: { value: newValue }
        } as React.ChangeEvent<HTMLInputElement>
        onChange(syntheticEvent)
        
        setTimeout(() => {
          input.setSelectionRange(start, start)
        }, 0)
      }
    } else if (key === 'Enter') {
      setShowKeyboard(false)
      input.blur()
    } else if (key !== ' ' || validationType !== 'ip') {
      // Insert character (prevent space in IP addresses)
      if (validationType === 'ip' && key === ' ') return
      
      // Check comma prevention
      if ((validationType === 'ip' || validationType === 'dns') && key === ',') {
        setValidation({
          isValid: false,
          error: 'Commas are not allowed. Use separate fields for multiple values.'
        })
        setTimeout(() => {
          setValidation({ isValid: true })
        }, 3000)
        return
      }

      const newValue = currentValue.slice(0, start) + key + currentValue.slice(end)
      const syntheticEvent = {
        target: { value: newValue }
      } as React.ChangeEvent<HTMLInputElement>
      onChange(syntheticEvent)
      
      // Set cursor position
      setTimeout(() => {
        input.setSelectionRange(start + 1, start + 1)
      }, 0)
    }
  }

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    setIsFocused(true)
    if (enableKeyboard) {
      setShowKeyboard(true)
    }
    onFocus?.(e)
  }

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    setIsFocused(false)
    // Don't immediately close keyboard to allow clicking on keys
    // Only close if the new focus target is not within the keyboard or another input
    setTimeout(() => {
      const activeElement = document.activeElement
      const isKeyboardElement = activeElement?.closest('[data-keyboard-container]') || 
                               activeElement?.closest('.fixed.inset-0.z-\\[99999\\]') ||
                               document.querySelector('.fixed.inset-0.z-\\[99999\\]')?.contains(activeElement)
      const isInputElement = activeElement?.tagName === 'INPUT'
      
      if (!isKeyboardElement && !isInputElement) {
        setShowKeyboard(false)
      }
    }, 200) // Increased timeout to ensure portal keyboard renders
    onBlur?.(e)
  }

  const toggleKeyboard = () => {
    setShowKeyboard(!showKeyboard)
    if (!showKeyboard) {
      inputRef.current?.focus()
    }
  }

  // Prevent right-click on keyboard button
  const handleKeyboardButtonContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    return false
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input
          ref={inputRef}
          value={value}
          onChange={handleInputChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          className={`${className || ''} ${validation.isValid ? '' : 'border-red-500 focus:border-red-500'}`}
          data-keyboard-input="true"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck="false"
          {...props}
        />
        {showKeyboardButton && enableKeyboard && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={toggleKeyboard}
            className="px-3"
            onMouseDown={(e) => e.preventDefault()} // Prevent focus loss from input
            onContextMenu={handleKeyboardButtonContextMenu} // Disable right-click
          >
            <Keyboard className="w-4 h-4" />
          </Button>
        )}
      </div>
      
      {!validation.isValid && validation.error && (
        <Alert className="border-red-200 bg-red-50">
          <AlertCircle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-700">
            {validation.error}
          </AlertDescription>
        </Alert>
      )}

      {/* Keyboard will be rendered via portal now, so we don't need this container */}
      <OnScreenKeyboard
        isVisible={showKeyboard}
        onKeyPress={handleKeyboardInput}
        onClose={() => setShowKeyboard(false)}
        targetType={validationType}
      />
    </div>
  )
} 