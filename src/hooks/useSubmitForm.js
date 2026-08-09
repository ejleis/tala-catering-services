import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiError } from '../lib/api.js'

/**
 * Shared submit lifecycle for the inquiry and booking forms.
 *
 * Handles: client-side validation, in-flight state, server field errors,
 * abort-on-unmount, and double-submit prevention.
 */
export function useSubmitForm({ validate, submit, onSuccess }) {
  const [status, setStatus] = useState('idle') // idle | submitting | success | error
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState(null)
  const controllerRef = useRef(null)

  // Abort any in-flight request if the component unmounts, so we never call
  // setState on an unmounted component.
  useEffect(() => () => controllerRef.current?.abort(), [])

  const handleSubmit = useCallback(
    async (values) => {
      // Guard against double submission from rapid clicks or Enter-key repeats.
      if (status === 'submitting') return

      const validationErrors = validate(values)
      if (Object.keys(validationErrors).length > 0) {
        setErrors(validationErrors)
        setFormError('Please correct the highlighted fields.')
        setStatus('error')
        return
      }

      setErrors({})
      setFormError(null)
      setStatus('submitting')

      controllerRef.current?.abort()
      const controller = new AbortController()
      controllerRef.current = controller

      try {
        const result = await submit(values, { signal: controller.signal })
        setStatus('success')
        onSuccess?.(result)
      } catch (error) {
        if (error?.name === 'AbortError') return
        if (error instanceof ApiError) {
          setErrors(error.fieldErrors ?? {})
          setFormError(error.message)
        } else {
          setFormError('Something went wrong. Please try again.')
        }
        setStatus('error')
      }
    },
    [status, validate, submit, onSuccess],
  )

  const reset = useCallback(() => {
    setStatus('idle')
    setErrors({})
    setFormError(null)
  }, [])

  return { status, errors, formError, handleSubmit, reset, setErrors }
}
