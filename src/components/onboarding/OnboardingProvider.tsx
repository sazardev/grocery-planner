import { useCallback, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../lib/auth/useAuth.ts'
import { OnboardingContext } from './onboarding.ts'
import { TOUR_STEPS } from './tourSteps.ts'
import type { TourStep } from './tourSteps.ts'

const DONE_KEY = 'gp-onboarding-done'

function doneFlag() {
  try {
    return localStorage.getItem(DONE_KEY) === '1'
  } catch {
    return false
  }
}
function markDone() {
  try {
    localStorage.setItem(DONE_KEY, '1')
  } catch {
    /* sin almacenamiento */
  }
}

/** Espera a que el elemento exista en el DOM (puede llegar tras navegar). */
function waitForElement(step: TourStep, timeout = 3000): Promise<Element | null> {
  return new Promise((resolve) => {
    const started = Date.now()
    const tryFind = () => {
      let el: Element | null = null
      if (step.selector) {
        el = document.querySelector(step.selector)
      }
      if (!el && step.text) {
        el = findElementByText(step.text)
      }
      if (el) return resolve(el)
      if (Date.now() - started > timeout) return resolve(null)
      setTimeout(tryFind, 80)
    }
    tryFind()
  })
}

function findElementByText(text: string): Element | null {
  const wanted = text.trim()
  const candidates = Array.from(document.querySelectorAll<HTMLElement>(
    'button, a, [role="tab"], h1, h2, h3, label, input, span',
  ))
  return candidates.find((el) => {
    const t = (el.textContent ?? '').trim()
    return t === wanted || t.startsWith(wanted)
  }) ?? null
}

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [active, setActive] = useState(false)
  const [step, setStep] = useState<{
    index: number
    rect: DOMRect | null
    step: TourStep
    total: number
  } | null>(null)
  const indexRef = useRef(0)

  const showStep = useCallback(
    async (idx: number) => {
      const stepDef = TOUR_STEPS[idx]
      if (!stepDef) {
        setActive(false)
        setStep(null)
        markDone()
        return
      }
      indexRef.current = idx
      if (stepDef.route) {
        navigate(stepDef.route)
      }
      const el = await waitForElement(stepDef)
      const rect = el ? el.getBoundingClientRect() : null
      setStep({ index: idx, rect, step: stepDef, total: TOUR_STEPS.length })
      setActive(true)
      // Resalta el elemento real (pulso) además del spotlight.
      if (el instanceof HTMLElement) {
        el.setAttribute('data-tour-highlight', '')
        const clear = () => el.removeAttribute('data-tour-highlight')
        window.setTimeout(clear, 2200)
      }
    },
    [navigate],
  )

  const start = useCallback(() => {
    setActive(true)
    showStep(0)
  }, [showStep])

  const stop = useCallback(() => {
    setActive(false)
    setStep(null)
    markDone()
  }, [])

  const next = useCallback(() => {
    showStep(indexRef.current + 1)
  }, [showStep])

  // Auto-arranque: primera vez tras iniciar sesión.
  const startedOnce = useRef(false)
  useEffect(() => {
    if (user && !startedOnce.current) {
      startedOnce.current = true
      if (!doneFlag()) {
        const t = window.setTimeout(() => start(), 900)
        return () => window.clearTimeout(t)
      }
    }
  }, [user, start])

  return (
    <OnboardingContext.Provider value={{ active, start, stop, next, step }}>
      {children}
    </OnboardingContext.Provider>
  )
}
