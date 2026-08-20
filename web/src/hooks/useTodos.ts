import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { todoApi, type Todo, type TodoListParams } from '../services/api'

export function useTodos(params: TodoListParams = {}) {
  return useQuery({
    queryKey: ['todos', params],
    queryFn: () => todoApi.list(params),
    placeholderData: (previousData) => previousData,
  })
}

export function useTodo(id: string) {
  return useQuery({
    queryKey: ['todo', id],
    queryFn: () => todoApi.get(id),
    enabled: !!id,
  })
}

export function useCreateTodo() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: todoApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['todos'] })
    },
  })
}

export function useUpdateTodo() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Todo> }) => todoApi.update(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['todos'] })
      queryClient.invalidateQueries({ queryKey: ['todo', id] })
    },
  })
}

export function useBatchUpdateTodos() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ ids, status, priority }: { ids: string[]; status?: string; priority?: number }) =>
      todoApi.batchUpdate(ids, status, priority),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['todos'] })
    },
  })
}

export function useDeleteTodo() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: todoApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['todos'] })
    },
  })
}