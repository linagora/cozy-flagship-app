import { EventEmitter } from 'events'

import { useEffect, useState } from 'react'

const HOME_AVAILABILITY_CHANGED = 'HOME_AVAILABILITY_CHANGED'

let homeUnavailable = false

const homeAvailabilityEventHandler = new EventEmitter()

const setHomeUnavailable = (value: boolean): void => {
  if (homeUnavailable === value) return

  homeUnavailable = value
  homeAvailabilityEventHandler.emit(HOME_AVAILABILITY_CHANGED)
}

export const markHomeUnavailable = (): void => setHomeUnavailable(true)

export const markHomeAvailable = (): void => setHomeUnavailable(false)

export const isHomeUnavailable = (): boolean => homeUnavailable

export const useIsHomeUnavailable = (): boolean => {
  const [unavailable, setUnavailable] = useState(isHomeUnavailable)

  useEffect(() => {
    const handleHomeAvailabilityChanged = (): void => {
      setUnavailable(isHomeUnavailable())
    }

    handleHomeAvailabilityChanged()

    homeAvailabilityEventHandler.on(
      HOME_AVAILABILITY_CHANGED,
      handleHomeAvailabilityChanged
    )

    return () => {
      homeAvailabilityEventHandler.off(
        HOME_AVAILABILITY_CHANGED,
        handleHomeAvailabilityChanged
      )
    }
  }, [])

  return unavailable
}
