import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { markdownApi, type MarkdownLog, type MarkdownLogSearchParams } from '../services/api'

export function useMarkdownLogs(params: MarkdownLogSearchParams = {}) {
  return useQuery({
    queryKey: ['markdown-logs', params],
    queryFn: () => markdownApi.list(params),
    placeholderData: (previousData) => previousData,
  })
}

export function useMarkdownStats(start_date?: string, end_date?: string) {
  return useQuery({
    queryKey: ['markdown-stats', start_date, end_date],
    queryFn: () => markdownApi.stats(start_date, end_date),
  })
}

export function useMarkdownLog(id: string) {
  return useQuery({
    queryKey: ['markdown-log', id],
    queryFn: () => markdownApi.get(id),
    enabled: !!id,
  })
}

export function useCreateMarkdownLog() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: markdownApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['markdown-logs'] })
      queryClient.invalidateQueries({ queryKey: ['markdown-calendar'] })
      queryClient.invalidateQueries({ queryKey: ['markdown-stats'] })
    },
  })
}

export function useUpdateMarkdownLog() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<MarkdownLog> }) => markdownApi.update(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['markdown-logs'] })
      queryClient.invalidateQueries({ queryKey: ['markdown-log', id] })
      queryClient.invalidateQueries({ queryKey: ['markdown-stats'] })
    },
  })
}

export function useDeleteMarkdownLog() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: markdownApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['markdown-logs'] })
      queryClient.invalidateQueries({ queryKey: ['markdown-calendar'] })
      queryClient.invalidateQueries({ queryKey: ['markdown-stats'] })
    },
  })
}

export function useBatchImportMarkdown() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: markdownApi.batchImport,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['markdown-logs'] })
      queryClient.invalidateQueries({ queryKey: ['markdown-calendar'] })
      queryClient.invalidateQueries({ queryKey: ['markdown-stats'] })
    },
  })
}