import { useMutation } from '@tanstack/react-query'
import { ragApi } from '../services/api'

export function useRAGQuery() {
  return useMutation({
    mutationFn: (data: Parameters<typeof ragApi.query>[0]) => ragApi.query(data),
  })
}

export function useRAGChat() {
  return useMutation({
    mutationFn: (data: Parameters<typeof ragApi.chat>[0]) => ragApi.chat(data),
  })
}

export function useRAGStats() {
  return useMutation({
    mutationFn: () => ragApi.stats(),
  })
}