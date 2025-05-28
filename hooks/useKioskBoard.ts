import { useEffect, useRef } from 'react';

declare global {
  interface Window {
    KioskBoard: any;
  }
}

interface KioskBoardConfig {
  language?: string;
  theme?: string;
  autoScroll?: boolean;
  cssAnimations?: boolean;
  cssAnimationsDuration?: number;
  cssAnimationsStyle?: string;
  keysAllowSpacebar?: boolean;
  keysSpacebarText?: string;
  keysFontFamily?: string;
  keysFontSize?: string;
  keysFontWeight?: string;
  keysIconSize?: string;
  allowRealKeyboard?: boolean;
  allowMobileKeyboard?: boolean;
  keysArrayOfObjects?: any[];
  keysJsonUrl?: string;
}

export function useKioskBoard(config: KioskBoardConfig = {}) {
  const isLibraryLoaded = useRef(false);
  const isInitialized = useRef(false);
  const observer = useRef<MutationObserver | null>(null);
  const processedElements = useRef(new WeakSet<Element>());
  const scanInterval = useRef<NodeJS.Timeout | null>(null);
  const originalModalPositions = useRef(new Map<Element, string>());

  // Default keyboard layout for network configuration
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
  ];

  const defaultConfig = {
    language: 'en',
    theme: 'light',
    allowRealKeyboard: true,
    allowMobileKeyboard: false,
    autoScroll: false, // Disable auto-scroll globally to prevent conflicts
    cssAnimations: true,
    cssAnimationsDuration: 360,
    cssAnimationsStyle: 'slide',
    keysAllowSpacebar: true,
    keysSpacebarText: 'Space',
    keysFontFamily: 'sans-serif',
    keysFontSize: '18px',
    keysFontWeight: 'normal',
    keysIconSize: '20px',
    keysArrayOfObjects: defaultKeysArray,
    ...config
  };

  const isInputElement = (element: Element): boolean => {
    const tagName = element.tagName.toLowerCase();
    if (tagName === 'textarea') return true;
    if (tagName === 'input') {
      const type = (element as HTMLInputElement).type.toLowerCase();
      return ['text', 'number', 'email', 'password', 'search', 'url', 'tel'].includes(type);
    }
    return false;
  };

  const findModalContainer = (element: Element): Element | null => {
    return element.closest('[role="dialog"], .modal, [data-radix-popper-content-wrapper], [data-state="open"]');
  };

  const moveModalUp = (modalElement: Element) => {
    const modal = modalElement as HTMLElement;
    if (!originalModalPositions.current.has(modal)) {
      // Store original transform
      originalModalPositions.current.set(modal, modal.style.transform || '');
    }
    
    // Move modal up by 200px to make room for keyboard
    const currentTransform = modal.style.transform || '';
    const translateYMatch = currentTransform.match(/translateY\(([^)]+)\)/);
    const currentY = translateYMatch ? parseFloat(translateYMatch[1]) : 0;
    const newY = currentY - 200;
    
    const newTransform = currentTransform.replace(/translateY\([^)]+\)/, '') + ` translateY(${newY}px)`;
    modal.style.transform = newTransform.trim();
    modal.style.transition = 'transform 0.3s ease';
    
    console.log('Moved modal up to make room for keyboard');
  };

  const restoreModalPosition = (modalElement: Element) => {
    const modal = modalElement as HTMLElement;
    const originalTransform = originalModalPositions.current.get(modal);
    
    if (originalTransform !== undefined) {
      modal.style.transform = originalTransform;
      modal.style.transition = 'transform 0.3s ease';
      originalModalPositions.current.delete(modal);
      console.log('Restored modal to original position');
    }
  };

  const addKioskBoardStyles = () => {
    // Add custom styles to ensure KioskBoard appears above modals
    const styleId = 'kioskboard-modal-fix';
    if (document.getElementById(styleId)) return;

    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      /* Ensure KioskBoard appears above modals and other overlays */
      #KioskBoard-VirtualKeyboard {
        z-index: 99999 !important;
        position: fixed !important;
        bottom: 0 !important;
        left: 0 !important;
        right: 0 !important;
        width: 100% !important;
      }
      
      /* Prevent modal backdrop from interfering with keyboard */
      .kioskboard-backdrop-fix {
        pointer-events: none !important;
      }
      
      /* Ensure keyboard keys are clickable and prevent event bubbling */
      #KioskBoard-VirtualKeyboard * {
        pointer-events: auto !important;
      }
      
      /* Prevent clicks on keyboard from bubbling to modal backdrop */
      #KioskBoard-VirtualKeyboard {
        pointer-events: auto !important;
      }
      
      /* Fix for Radix UI Dialog overlays - lower their z-index */
      [data-radix-popper-content-wrapper],
      [data-radix-portal] {
        z-index: 50 !important;
      }
      
      /* Ensure dialog content stays below keyboard */
      [role="dialog"] {
        z-index: 40 !important;
      }
      
      /* Modal backdrop should not interfere with keyboard */
      .modal-backdrop,
      [data-radix-dialog-overlay] {
        z-index: 30 !important;
      }
      
      /* Ensure keyboard container has proper stacking */
      .kioskboard-wrapper {
        z-index: 99999 !important;
        position: relative !important;
      }
      
      /* Smooth transitions for modal movement */
      [role="dialog"],
      [data-radix-popper-content-wrapper] {
        transition: transform 0.3s ease !important;
      }
    `;
    document.head.appendChild(style);
    console.log('Added KioskBoard modal compatibility styles');
  };

  const enableKioskBoardForElement = (element: Element) => {
    if (window.KioskBoard && isInitialized.current && !processedElements.current.has(element)) {
      try {
        console.log('Enabling KioskBoard for element (proactive):', element);
        
        // Check if element is inside a modal
        const modalContainer = findModalContainer(element);
        
        // Create element-specific config for modal handling
        const elementConfig = {
          ...defaultConfig,
          // Always disable auto-scroll to prevent interference
          autoScroll: false,
        };
        
        window.KioskBoard.run(element, elementConfig);
        processedElements.current.add(element);
        console.log('KioskBoard enabled successfully for element:', element, modalContainer ? '(in modal)' : '');
      } catch (error) {
        console.error('Error enabling KioskBoard for element:', element, error);
      }
    }
  };

  const scanAndEnableInputs = () => {
    if (!window.KioskBoard || !isInitialized.current) return;
    
    console.log('Scanning for input elements...');
    const inputs = document.querySelectorAll('input, textarea');
    console.log('Found input elements:', inputs.length);
    
    let newElementsFound = 0;
    inputs.forEach(input => {
      if (isInputElement(input) && !processedElements.current.has(input)) {
        enableKioskBoardForElement(input);
        newElementsFound++;
      }
    });
    
    if (newElementsFound > 0) {
      console.log(`Enabled KioskBoard on ${newElementsFound} new input elements`);
    }
  };

  const initializeKioskBoard = () => {
    if (window.KioskBoard && isLibraryLoaded.current && !isInitialized.current) {
      try {
        console.log('Initializing KioskBoard globally...');
        window.KioskBoard.init(defaultConfig);
        isInitialized.current = true;
        console.log('KioskBoard initialized successfully');
        
        // Add modal compatibility styles
        addKioskBoardStyles();
        
        // Immediately scan for existing inputs
        scanAndEnableInputs();
        
        // Set up mutation observer to watch for new input elements
        setupMutationObserver();
        
        // Set up periodic scanning to catch any missed elements
        setupPeriodicScanning();
        
        // Add global event listener to handle modal interactions
        setupModalEventHandling();
        
        // Set up keyboard visibility monitoring
        setupKeyboardVisibilityMonitoring();
        
      } catch (error) {
        console.error('Error initializing KioskBoard:', error);
      }
    }
  };

  const setupModalEventHandling = () => {
    // Prevent ALL events from keyboard from bubbling to prevent modal closure
    const preventEventBubbling = (event: Event) => {
      const target = event.target as Element;
      const keyboardElement = target.closest('#KioskBoard-VirtualKeyboard');
      
      if (keyboardElement) {
        // Stop ALL event propagation from keyboard
        event.stopPropagation();
        event.stopImmediatePropagation();
        console.log('Prevented event bubbling from keyboard:', event.type);
      }
    };

    // Add event listeners for all possible events that could close modals
    const events = ['click', 'mousedown', 'mouseup', 'touchstart', 'touchend', 'pointerdown', 'pointerup'];
    
    events.forEach(eventType => {
      document.addEventListener(eventType, preventEventBubbling, true);
    });

    // Handle escape key to close keyboard instead of modal when keyboard is open
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        const keyboardVisible = document.querySelector('#KioskBoard-VirtualKeyboard');
        if (keyboardVisible && window.KioskBoard) {
          event.stopPropagation();
          event.stopImmediatePropagation();
          window.KioskBoard.close();
          console.log('Closed KioskBoard with Escape key');
        }
      }
    }, true);

    console.log('Set up comprehensive modal event handling');
  };

  const setupKeyboardVisibilityMonitoring = () => {
    // Monitor for keyboard appearance/disappearance
    const keyboardObserver = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const element = node as Element;
            if (element.id === 'KioskBoard-VirtualKeyboard' || element.querySelector('#KioskBoard-VirtualKeyboard')) {
              console.log('Virtual keyboard appeared');
              // Find any open modals and move them up
              const modals = document.querySelectorAll('[role="dialog"], [data-state="open"]');
              modals.forEach(modal => {
                if (modal.checkVisibility && modal.checkVisibility()) {
                  moveModalUp(modal);
                }
              });
            }
          }
        });
        
        mutation.removedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const element = node as Element;
            if (element.id === 'KioskBoard-VirtualKeyboard' || element.querySelector('#KioskBoard-VirtualKeyboard')) {
              console.log('Virtual keyboard disappeared');
              // Restore modal positions
              const modals = document.querySelectorAll('[role="dialog"], [data-state="open"]');
              modals.forEach(modal => {
                restoreModalPosition(modal);
              });
            }
          }
        });
      });
    });

    keyboardObserver.observe(document.body, {
      childList: true,
      subtree: true
    });

    console.log('Set up keyboard visibility monitoring');
  };

  const setupMutationObserver = () => {
    if (observer.current) return; // Already set up
    
    console.log('Setting up MutationObserver for new input elements...');
    observer.current = new MutationObserver((mutations) => {
      let shouldScan = false;
      
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const element = node as Element;
            
            // Check if the added node itself is an input
            if (isInputElement(element)) {
              enableKioskBoardForElement(element);
            }
            
            // Check for input elements within the added node
            const inputs = element.querySelectorAll('input, textarea');
            if (inputs.length > 0) {
              shouldScan = true;
            }
          }
        });
      });
      
      // If we found inputs in added nodes, do a full scan
      if (shouldScan) {
        setTimeout(() => {
          scanAndEnableInputs();
        }, 50);
      }
    });

    observer.current.observe(document.body, {
      childList: true,
      subtree: true
    });
  };

  const setupPeriodicScanning = () => {
    // Scan every 2 seconds to catch any elements that might have been missed
    scanInterval.current = setInterval(() => {
      scanAndEnableInputs();
    }, 2000);
    
    console.log('Set up periodic scanning every 2 seconds');
  };

  const cleanup = () => {
    if (observer.current) {
      observer.current.disconnect();
      observer.current = null;
    }
    
    if (scanInterval.current) {
      clearInterval(scanInterval.current);
      scanInterval.current = null;
    }
  };

  useEffect(() => {
    console.log('KioskBoard hook initializing...');
    
    // Load KioskBoard if not already loaded
    if (typeof window !== 'undefined' && !window.KioskBoard && !isLibraryLoaded.current) {
      console.log('Loading KioskBoard library...');
      
      // Create script tag to load KioskBoard
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/kioskboard@2.3.0/dist/kioskboard-aio-2.3.0.min.js';
      script.async = true;
      
      // Create link tag for CSS
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://cdn.jsdelivr.net/npm/kioskboard@2.3.0/dist/kioskboard-2.3.0.min.css';
      
      // Add to head
      document.head.appendChild(link);
      document.head.appendChild(script);
      
      script.onload = () => {
        console.log('KioskBoard library loaded successfully');
        isLibraryLoaded.current = true;
        // Multiple initialization attempts to ensure it works
        setTimeout(() => initializeKioskBoard(), 100);
        setTimeout(() => initializeKioskBoard(), 500);
        setTimeout(() => initializeKioskBoard(), 1000);
      };

      script.onerror = () => {
        console.error('Failed to load KioskBoard library');
      };
    } else if (window.KioskBoard) {
      console.log('KioskBoard already available');
      isLibraryLoaded.current = true;
      // Multiple initialization attempts to ensure it works
      setTimeout(() => initializeKioskBoard(), 100);
      setTimeout(() => initializeKioskBoard(), 500);
      setTimeout(() => initializeKioskBoard(), 1000);
    }

    // Cleanup function
    return () => {
      cleanup();
    };
  }, []);

  // Additional effect to scan when component updates
  useEffect(() => {
    if (isInitialized.current) {
      // Scan immediately when this effect runs
      scanAndEnableInputs();
      
      // Also scan after a short delay to catch React updates
      const timeouts = [100, 300, 500, 1000].map(delay => 
        setTimeout(() => {
          scanAndEnableInputs();
        }, delay)
      );
      
      return () => {
        timeouts.forEach(timeout => clearTimeout(timeout));
      };
    }
  });

  const enableKioskBoard = (selector: string) => {
    if (typeof window !== 'undefined' && window.KioskBoard && isInitialized.current) {
      try {
        console.log('Manual enableKioskBoard called with selector:', selector);
        const elements = document.querySelectorAll(selector);
        console.log('Found elements for manual enable:', elements.length);
        elements.forEach(element => {
          if (isInputElement(element)) {
            enableKioskBoardForElement(element);
          }
        });
      } catch (error) {
        console.error('Error enabling KioskBoard:', error);
      }
    }
  };

  const disableKioskBoard = () => {
    if (window.KioskBoard) {
      try {
        window.KioskBoard.close();
      } catch (error) {
        console.error('Error disabling KioskBoard:', error);
      }
    }
  };

  return {
    enableKioskBoard,
    disableKioskBoard,
    isReady: isLibraryLoaded.current && isInitialized.current && !!window.KioskBoard
  };
} 