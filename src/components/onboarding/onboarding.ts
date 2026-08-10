import { createContext, useContext } from 'react'
import { TOUR_STEPS } from './tourSteps.ts'
import type { TourStep } from './tourSteps.ts'

export interface StepState {
  index: number
  rect: DOMRect | null
  step: TourStep
  total: number
}

interface OnboardingContextValue {
  active: boolean
  start: () => void
  stop: () => void
  next: () => void
  step: StepState | null
}

export const OnboardingContext = createContext<OnboardingContextValue>({
  active: false,
  start: () => {},
  stop: () => {},
  next: () => {},
  step: null,
})

export const useOnboarding = () => useContext(OnboardingContext)

/** Re-exporta los pasos para quienes quieran consultar el tour. */
export { TOUR_STEPS }
